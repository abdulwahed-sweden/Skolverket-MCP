/**
 * Ali Swedish Tutor — steg 1: extraktion av läroplansdata per stadium.
 *
 * ISOLERAD MODUL. Rör ingen befintlig kod. Enda uppgift: läsa Skolverkets
 * Syllabus API via den befintliga `syllabusApi`-klienten och normalisera svaret
 * till en liten representation som en handledare kan arbeta mot.
 *
 * Grundregel: inget fält här får uppfinnas. Varje värde härleds ur faktiska
 * API-fält, och `provenance` pekar ut exakt var det kom ifrån.
 *
 * VIKTIGT OM ÅRSKURS 5:
 * Skolverket publicerar INTE centralt innehåll per årskurs i grundskolan.
 * `centralContents[].year` har värdena "1-3", "4-6" och "7-9". Årskurs 5 finns
 * alltså bara som en del av stadiet 4–6. Betygskriterier finns bara för
 * årskurs 1, 3, 6 och 9 — aldrig för årskurs 5. Den distinktionen bevaras
 * explicit nedan (`stage.gradeIsExplicitInApi`, `assessment.*`) i stället för
 * att döljas.
 */

import { syllabusApi } from '../api/syllabus-client.js';
import type {
  Subject,
  SubjectResponse,
  Curriculum,
  CurriculumResponse,
  CentralContent,
  KnowledgeRequirement,
} from '../types/syllabus.js';

// Formerna nedan kommer nu från `src/types/syllabus.ts`, som är avstämd mot den
// officiella OpenAPI-specifikationen. Alias behålls för läsbarhet här.
export type {
  Subject,
  SubjectResponse,
  Curriculum,
  CurriculumResponse,
  CentralContent,
  KnowledgeRequirement,
};

// ---------------------------------------------------------------------------
// Normaliserad representation
// ---------------------------------------------------------------------------

/** Ett stadium så som Skolverket grupperar årskurser i grundskolan. */
export interface Stage {
  /** Exakt värdet ur `centralContents[].year`, t.ex. "4-6". */
  id: string;
  /** Årskurserna som ingår, utlästa ur `id`. */
  years: number[];
  /** Årskursen handledaren undervisar, t.ex. 5. */
  requestedGrade: number;
  /**
   * Alltid `false` för grundskolan: API:et har inget innehåll per enskild
   * årskurs. Fältet finns för att en konsument ska tvingas se skillnaden.
   */
  gradeIsExplicitInApi: boolean;
  /** Slutåret för stadiet, dit betygskriterierna hör. "4-6" → "6". */
  assessmentYear: string;
}

/** En <h4>-rubrik med sina <li>-punkter ur ett block centralt innehåll. */
export interface ContentHeading {
  title: string;
  items: string[];
}

export interface CentralContentForStage {
  year: string;
  /** Rubriken ovanför blocket, ur `subject.centralCntHeading`. */
  sectionHeadingText: string;
  /** <h3> inuti blocket, t.ex. "I årskurs 4–6". */
  stageHeadingText: string;
  headings: ContentHeading[];
  /** Oförändrad HTML, för spårbarhet. */
  html: string;
}

export interface AssessmentCriterion {
  year: string;
  /** "A"–"E", eller null för godtagbara kunskaper (åk 1 och 3). */
  gradeStep: string | null;
  headingText: string;
  paragraphs: string[];
  /** Orden som API:et markerar med <strong> — Skolverkets värdeord. */
  valueWords: string[];
  html: string;
}

export interface NormalizedStageCurriculum {
  subject: {
    code: string;
    name: string;
    designation?: string;
    typeOfSyllabus: string;
    gradeScale?: string;
    version: number;
    startDate?: string;
    modifiedDate?: string;
    skolfsGrund?: string;
    skolfsAndring?: string;
  };
  schoolType: string;
  curriculum: {
    code: string;
    name: string;
    version: number;
    startDate?: string;
    modifiedDate?: string;
  } | null;
  stage: Stage;
  purpose: {
    headingText: string;
    paragraphs: string[];
    html: string;
  };
  centralContentForStage: CentralContentForStage;
  relevantAssessmentCriteria: {
    /** Kriterier för stadiets slutår (åk 6 för stadiet 4–6). */
    atStageEnd: AssessmentCriterion[];
    /** Föregående stadiums kriterier (åk 3) — utgångsläget eleven kommer från. */
    priorStageBaseline: AssessmentCriterion[];
    /** Sant när API:et saknar kriterier för just `requestedGrade`. */
    noneForRequestedGrade: boolean;
    sectionHeadingText: string;
  };
  provenance: {
    apiBaseUrl: string;
    apiVersion?: string;
    retrievedForDate?: string;
    subjectEndpoint: string;
    curriculumEndpoint: string | null;
    /** Vilka råa API-fält varje normaliserat fält kommer ur. */
    fieldMap: Record<string, string>;
    /** Stadievärden API:et faktiskt levererade, för kontroll. */
    availableCentralContentYears: string[];
    availableKnowledgeRequirementYears: string[];
  };
}

// ---------------------------------------------------------------------------
// HTML-hjälpare
//
// Innehållet använder ett litet, slutet taggförråd: p, ul, li, h2, h3, h4,
// strong. Inga HTML-entiteter förekommer. Texten innehåller mjuka bindestreck
// (U+00AD) från Skolverkets typografi; de tas bort eftersom de annars smiter
// in i prompter och strängjämförelser.
// ---------------------------------------------------------------------------

const SOFT_HYPHEN = /­/g;

/**
 * Specifikationen markerar inget fält som obligatoriskt, så allt är optional i
 * `src/types/syllabus.ts`. En handledare behöver ändå säkra värden. Hellre ett
 * tydligt fel här än `undefined` som läcker in i en prompt.
 */
function required<T>(value: T | undefined | null, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Skolverkets svar saknar fältet \`${field}\`, som krävs för handledaren.`);
  }
  return value;
}

function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(SOFT_HYPHEN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAll(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map((m) => m[1]);
}

function firstHeadingText(html: string, level: number): string {
  const m = html.match(new RegExp(`<h${level}[^>]*>([\\s\\S]*?)</h${level}>`));
  return m ? toText(m[1]) : '';
}

function paragraphTexts(html: string): string[] {
  return matchAll(html, /<p[^>]*>([\s\S]*?)<\/p>/g)
    .map(toText)
    .filter(Boolean);
}

/**
 * Delar ett block centralt innehåll i sina <h4>-grupper och tar ut <li>-punkterna
 * under varje. Ren omstrukturering av API:ets HTML — inget läggs till.
 */
function parseContentHeadings(html: string): ContentHeading[] {
  const headings: ContentHeading[] = [];
  const re = /<h4[^>]*>([\s\S]*?)<\/h4>/g;
  const marks = [...html.matchAll(re)];

  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : html.length;
    const body = html.slice(start, end);
    headings.push({
      title: toText(marks[i][1]),
      items: matchAll(body, /<li[^>]*>([\s\S]*?)<\/li>/g).map(toText).filter(Boolean),
    });
  }
  return headings;
}

function normalizeCriterion(raw: KnowledgeRequirement): AssessmentCriterion {
  const text = required(raw.text, 'knowledgeRequirements[].text');
  return {
    year: required(raw.year, 'knowledgeRequirements[].year'),
    gradeStep: raw.gradeStep ?? null,
    headingText: firstHeadingText(text, 3),
    paragraphs: paragraphTexts(text),
    valueWords: [...new Set(matchAll(text, /<strong[^>]*>([\s\S]*?)<\/strong>/g).map(toText))]
      .filter(Boolean),
    html: text,
  };
}

/** "4-6" → [4, 5, 6]. "6" → [6]. */
function yearsInStage(stageId: string): number[] {
  const parts = stageId.split('-').map((p) => Number.parseInt(p.trim(), 10));
  if (parts.some(Number.isNaN)) return [];
  if (parts.length === 1) return [parts[0]];
  const [from, to] = parts;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Slutåret i ett stadium — dit Skolverkets betygskriterier hör. "4-6" → "6". */
function stageEndYear(stageId: string): string {
  const years = yearsInStage(stageId);
  return years.length ? String(years[years.length - 1]) : stageId;
}

/** Stadiet före ett givet, enligt grundskolans faktiska indelning. */
const PRIOR_STAGE_END_YEAR: Record<string, string> = {
  '4-6': '3',
  '7-9': '6',
};

// ---------------------------------------------------------------------------
// Normalisering
// ---------------------------------------------------------------------------

export class StageNotAvailableError extends Error {
  constructor(subjectCode: string, stageId: string, available: string[]) {
    super(
      `Skolverket har inget centralt innehåll för stadiet "${stageId}" i ämnet ${subjectCode}. ` +
        `Tillgängliga stadier: ${available.join(', ') || '(inga)'}.`
    );
    this.name = 'StageNotAvailableError';
  }
}

export interface NormalizeOptions {
  /** Stadium enligt API:et, t.ex. "4-6". */
  stageId: string;
  /** Årskursen handledaren undervisar. Måste ligga inom stadiet. */
  requestedGrade: number;
  /** Skoltyp att redovisa. Valideras mot `subject.schoolTypes`. */
  schoolType: string;
  apiBaseUrl: string;
}

export function normalizeStageCurriculum(
  subjectEnvelope: SubjectResponse,
  curriculumEnvelope: CurriculumResponse | null,
  opts: NormalizeOptions
): NormalizedStageCurriculum {
  const s = subjectEnvelope.subject;
  if (!s) throw new Error('Svaret innehåller inget `subject`-objekt.');

  if (!s.schoolTypes?.includes(opts.schoolType)) {
    throw new Error(
      `Ämnet ${s.code} gäller inte skoltypen ${opts.schoolType}. ` +
        `API:et anger: ${(s.schoolTypes ?? []).join(', ')}.`
    );
  }

  const contents = s.centralContents ?? [];
  // Blockens `year` är stadievärden; ta bara med dem API:et faktiskt namngav.
  const availableYears = contents.map((cc) => cc.year).filter((y): y is string => !!y);
  const block = contents.find((cc) => cc.year === opts.stageId);
  if (!block) {
    throw new StageNotAvailableError(s.code ?? '(okänd kod)', opts.stageId, availableYears);
  }

  const years = yearsInStage(opts.stageId);
  if (!years.includes(opts.requestedGrade)) {
    throw new Error(
      `Årskurs ${opts.requestedGrade} ingår inte i stadiet "${opts.stageId}" (${years.join(', ')}).`
    );
  }

  const reqs = s.knowledgeRequirements ?? [];
  const endYear = stageEndYear(opts.stageId);
  const priorYear = PRIOR_STAGE_END_YEAR[opts.stageId];

  const c = curriculumEnvelope?.curriculum ?? null;
  const blockText = required(block.text, `centralContents[year=${opts.stageId}].text`);

  return {
    subject: {
      code: required(s.code, 'subject.code'),
      name: required(s.name, 'subject.name'),
      designation: s.designation,
      typeOfSyllabus: required(s.typeOfSyllabus, 'subject.typeOfSyllabus'),
      gradeScale: s.gradeScale,
      version: required(s.version, 'subject.version'),
      startDate: s.startDate,
      modifiedDate: s.modifiedDate,
      skolfsGrund: s.skolfsGrund,
      skolfsAndring: s.skolfsAndring,
    },
    schoolType: opts.schoolType,
    curriculum: c
      ? {
          code: required(c.code, 'curriculum.code'),
          name: required(c.name, 'curriculum.name'),
          version: required(c.version, 'curriculum.version'),
          startDate: c.startDate,
          modifiedDate: c.modifiedDate,
        }
      : null,
    stage: {
      id: opts.stageId,
      years,
      requestedGrade: opts.requestedGrade,
      // API:et har enbart stadiedata; ingen årskurs är explicit representerad.
      gradeIsExplicitInApi: false,
      assessmentYear: endYear,
    },
    purpose: {
      headingText: toText(s.purposeHeading ?? ''),
      paragraphs: paragraphTexts(s.purpose ?? ''),
      html: s.purpose ?? '',
    },
    centralContentForStage: {
      year: opts.stageId,
      sectionHeadingText: toText(s.centralCntHeading ?? ''),
      stageHeadingText: firstHeadingText(blockText, 3),
      headings: parseContentHeadings(blockText),
      html: blockText,
    },
    relevantAssessmentCriteria: {
      atStageEnd: reqs.filter((r) => r.year === endYear).map(normalizeCriterion),
      priorStageBaseline: priorYear
        ? reqs.filter((r) => r.year === priorYear).map(normalizeCriterion)
        : [],
      // Skolverket publicerar kriterier endast för stadiernas slutår.
      noneForRequestedGrade: !reqs.some((r) => r.year === String(opts.requestedGrade)),
      sectionHeadingText: toText(s.knowledgeReqsHeading ?? ''),
    },
    provenance: {
      apiBaseUrl: opts.apiBaseUrl,
      apiVersion: subjectEnvelope.apiVersion,
      retrievedForDate: subjectEnvelope.dateParam,
      subjectEndpoint: `/v1/subjects/${required(s.code, 'subject.code')}`,
      curriculumEndpoint: c ? `/v1/curriculums/${c.code}` : null,
      fieldMap: {
        'subject.*': 'subjects/{code} → subject.{code,name,designation,gradeScale,version,...}',
        schoolType: 'subject.schoolTypes[] (array i API:et, ej en sträng)',
        'curriculum.*': 'curriculums/{code} → curriculum.{code,name,version,startDate}',
        'stage.id': 'subject.centralContents[].year',
        'stage.years': 'härlett ur stage.id genom att expandera intervallet',
        'stage.assessmentYear': 'sista året i stage.id; matchar knowledgeRequirements[].year',
        purpose: 'subject.purpose (HTML-sträng) + subject.purposeHeading',
        centralContentForStage:
          'subject.centralContents[year === stage.id].text + subject.centralCntHeading',
        'centralContentForStage.headings': '<h4>/<li> inuti samma text-fält',
        'relevantAssessmentCriteria.atStageEnd':
          'subject.knowledgeRequirements[year === stage.assessmentYear]',
        'relevantAssessmentCriteria.priorStageBaseline':
          'subject.knowledgeRequirements[year === föregående stadiums slutår]',
        '*.valueWords': '<strong>-markeringar i knowledgeRequirements[].text',
      },
      availableCentralContentYears: availableYears,
      availableKnowledgeRequirementYears: [
        ...new Set(reqs.map((r) => r.year).filter((y): y is string => !!y)),
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Hämtning — återanvänder den befintliga `syllabusApi`-klienten
// ---------------------------------------------------------------------------

export interface FetchStageOptions {
  subjectCode: string;
  schoolType?: string;
  stageId?: string;
  requestedGrade?: number;
  /** Läroplanskod, t.ex. "LGR22". Hämtas automatiskt om den utelämnas. */
  curriculumCode?: string;
  /** YYYY-MM-DD. Skickas vidare till API:et. */
  date?: string;
  subjectVersion?: number;
}

/**
 * Hämtar ett ämne (och skoltypens läroplan) och normaliserar för ett stadium.
 *
 * `syllabusApi.getSubject` är typad som `Subject` men returnerar i praktiken
 * envelopen; vi castar till den verifierade formen i stället för att ändra
 * den delade klienten.
 */
export async function fetchStageCurriculum(
  opts: FetchStageOptions
): Promise<NormalizedStageCurriculum> {
  const schoolType = opts.schoolType ?? 'GR';
  const stageId = opts.stageId ?? '4-6';
  const requestedGrade = opts.requestedGrade ?? 5;

  const subjectEnvelope = (await syllabusApi.getSubject(
    opts.subjectCode,
    opts.subjectVersion,
    opts.date
  )) as unknown as SubjectResponse;

  let curriculumCode = opts.curriculumCode;
  if (!curriculumCode) {
    const found = await syllabusApi.searchCurriculums({
      schooltype: schoolType,
      timespan: 'LATEST',
      ...(opts.date ? { date: opts.date } : {}),
    });
    curriculumCode = found.curriculums?.[0]?.code;
  }

  const curriculumEnvelope = curriculumCode
    ? ((await syllabusApi.getCurriculum(
        curriculumCode,
        undefined,
        opts.date
      )) as unknown as CurriculumResponse)
    : null;

  const { config } = await import('../config.js');

  return normalizeStageCurriculum(subjectEnvelope, curriculumEnvelope, {
    stageId,
    requestedGrade,
    schoolType,
    apiBaseUrl: config.syllabusApiBaseUrl,
  });
}

/** Ämneskoder verifierade mot live-API:et 2026-09-27. */
export const GRUNDSKOLA_SWEDISH_SUBJECT_CODES = {
  /** Svenska, grundskolan. */
  svenska: 'GRGRSVE01',
  /** Svenska som andraspråk, grundskolan. */
  svenskaSomAndrasprak: 'GRGRSVA01',
} as const;
