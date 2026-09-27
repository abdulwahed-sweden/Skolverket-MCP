/**
 * Ali Swedish Tutor — steg 2: gör stadieinnehållet undervisningsbart.
 *
 * Tar den normaliserade representationen från `curriculum-stage.ts` och delar upp
 * den i namngivna enheter som en handledare kan välja mellan, samt en textbrief
 * som kan läggas in som grundning i en handledarprompt.
 *
 * TVÅ REGLER SOM STYR HELA FILEN:
 *
 * 1. Ingen text hittas på. Varje mening i briefen kommer ordagrant från
 *    Skolverkets svar, förutom de rubriker och instruktioner som är tydligt
 *    märkta som våra (`OM DENNA BRIEF`, `REGLER FÖR HANDLEDAREN`).
 *
 * 2. Inga kopplingar hittas på. Skolverket anger INTE vilket betygskriterium
 *    som hör till vilken punkt i det centrala innehållet. Därför hålls enheter
 *    och kriterier isär: kriterierna gäller hela stadiet, inte en enskild enhet.
 *    Att låta en handledare tro något annat vore att uppfinna läroplan.
 */

import type { NormalizedStageCurriculum, AssessmentCriterion } from './curriculum-stage.js';

/** En rubrik ur det centrala innehållet, med sina punkter som undervisningsbara delar. */
export interface TeachableUnit {
  /** Stabil id för att kunna hänvisa till enheten, t.ex. "GRGRSVE01/4-6/lasa-och-skriva". */
  id: string;
  /** Rubriken ordagrant ur API:et, t.ex. "Läsa och skriva". */
  title: string;
  /** Punkterna under rubriken, ordagrant, med id per punkt. */
  contentPoints: { id: string; text: string }[];
}

export interface TeachingContext {
  subjectCode: string;
  subjectName: string;
  schoolType: string;
  curriculumCode: string | null;
  stageId: string;
  requestedGrade: number;
  /** Rubrikerna ur det centrala innehållet, som valbara enheter. */
  units: TeachableUnit[];
  /**
   * Kriterier för hela stadiet. Medvetet INTE kopplade till enskilda enheter —
   * Skolverket publicerar ingen sådan koppling.
   */
  stageAssessment: {
    assessmentYear: string;
    criteria: AssessmentCriterion[];
    priorStageBaseline: AssessmentCriterion[];
    noneForRequestedGrade: boolean;
  };
  /** Textbrief att grunda en handledarprompt i. */
  groundedBrief: string;
  /** Räknare som gör det lätt att se att inget tappats. */
  counts: { units: number; contentPoints: number; criteria: number };
}

// ---------------------------------------------------------------------------
// Id-generering
// ---------------------------------------------------------------------------

/** "Läsa och skriva" → "lasa-och-skriva". Bara för stabila id:n, aldrig för visning. */
function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Enheter
// ---------------------------------------------------------------------------

export function buildTeachableUnits(bundle: NormalizedStageCurriculum): TeachableUnit[] {
  const prefix = `${bundle.subject.code}/${bundle.stage.id}`;
  const seen = new Map<string, number>();

  return bundle.centralContentForStage.headings.map((h) => {
    // Rubriknamnen är unika i praktiken, men gör id:t kollisionssäkert ändå.
    const base = slug(h.title) || 'avsnitt';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const id = `${prefix}/${base}${n > 1 ? `-${n}` : ''}`;

    return {
      id,
      title: h.title,
      contentPoints: h.items.map((text, i) => ({ id: `${id}/${i + 1}`, text })),
    };
  });
}

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------

function criterionBlock(c: AssessmentCriterion): string {
  const lines = [`### ${c.headingText}`];
  for (const p of c.paragraphs) lines.push(p);
  if (c.valueWords.length) {
    // Värdeorden är Skolverkets egna <strong>-markeringar, inte vår tolkning.
    lines.push(`(Värdeord som Skolverket markerar: ${c.valueWords.join(', ')})`);
  }
  return lines.join('\n');
}

/**
 * Bygger den grundande texten. Allt läroplansinnehåll är ordagrant; det enda vi
 * lägger till är rubriker, härkomst och regler för handledaren.
 */
export function buildGroundedBrief(bundle: NormalizedStageCurriculum): string {
  const b = bundle;
  const units = buildTeachableUnits(b);
  const stageLabel = b.centralContentForStage.stageHeadingText || `Årskurs ${b.stage.id}`;

  const out: string[] = [];

  out.push(`# ${b.subject.name} — ${stageLabel}`);
  out.push('');
  out.push('## OM DENNA BRIEF');
  out.push(
    `Allt läroplansinnehåll nedan är hämtat ordagrant från Skolverkets Syllabus API. ` +
      `Ämne: ${b.subject.name} (${b.subject.code}). Skolform: ${b.schoolType}. ` +
      (b.curriculum
        ? `Läroplan: ${b.curriculum.code} version ${b.curriculum.version}. `
        : 'Ingen läroplan hämtad. ') +
      `Ämnesversion: ${b.subject.version}` +
      (b.subject.skolfsAndring ? ` (SKOLFS ${b.subject.skolfsAndring})` : '') +
      `. Betygsskala: ${b.subject.gradeScale ?? 'ej angiven'}. ` +
      `Hämtat via ${b.provenance.subjectEndpoint} den ${b.provenance.retrievedForDate ?? 'okänt datum'}.`
  );
  out.push('');

  // Den viktigaste avgränsningen först, så att den inte missas.
  out.push('## VAD SKOLVERKET FAKTISKT ANGER FÖR ÅRSKURS ' + b.stage.requestedGrade);
  out.push(
    `Skolverket publicerar centralt innehåll per stadium, inte per årskurs. ` +
      `Innehållet nedan gäller hela stadiet årskurs ${b.stage.id} ` +
      `(det vill säga årskurs ${b.stage.years.join(', ')}) — ` +
      `det finns INGET innehåll som är specifikt för årskurs ${b.stage.requestedGrade}.`
  );
  out.push(
    `Betygskriterier finns bara för slutet av årskurs ` +
      `${b.provenance.availableKnowledgeRequirementYears.join(', ')}. ` +
      `För det här stadiet gäller kriterierna i slutet av årskurs ${b.stage.assessmentYear}, ` +
      `vilket ligger efter årskurs ${b.stage.requestedGrade}. ` +
      `Det finns alltså inga kriterier att bedöma en elev i årskurs ${b.stage.requestedGrade} mot.`
  );
  out.push('');

  out.push(`## SYFTE (${b.purpose.headingText || 'Syfte'})`);
  for (const p of b.purpose.paragraphs) out.push(p);
  out.push('');

  out.push(`## CENTRALT INNEHÅLL — ${stageLabel}`);
  for (const u of units) {
    out.push('');
    out.push(`### ${u.title}  [${u.id}]`);
    for (const p of u.contentPoints) out.push(`- (${p.id}) ${p.text}`);
  }
  out.push('');

  out.push(
    `## BETYGSKRITERIER I SLUTET AV ÅRSKURS ${b.stage.assessmentYear} (mål framåt, inte bedömning nu)`
  );
  for (const c of b.relevantAssessmentCriteria.atStageEnd) {
    out.push('');
    out.push(criterionBlock(c));
  }
  out.push('');

  if (b.relevantAssessmentCriteria.priorStageBaseline.length) {
    out.push('## FÖREGÅENDE STADIUM (utgångsläge eleven förväntas komma från)');
    for (const c of b.relevantAssessmentCriteria.priorStageBaseline) {
      out.push('');
      out.push(criterionBlock(c));
    }
    out.push('');
  }

  out.push('## REGLER FÖR HANDLEDAREN');
  out.push(
    '- Undervisa bara inom det centrala innehållet ovan. Behöver du något som inte står där, ' +
      'säg att det ligger utanför läroplanen för det här stadiet.'
  );
  out.push(
    `- Säg aldrig att Skolverket anger något specifikt för årskurs ${b.stage.requestedGrade}. ` +
      `Det gör Skolverket inte. Val av takt och ordning inom stadiet är lärarens bedömning, inte läroplanens.`
  );
  out.push(
    '- Skolverket kopplar inte betygskriterier till enskilda punkter i det centrala innehållet. ' +
      'Hitta inte på sådana kopplingar. Kriterierna gäller hela stadiet.'
  );
  out.push('- Hänvisa till innehåll med id:t i parentes, t.ex. ' + `(${units[0]?.contentPoints[0]?.id ?? 'id'}).`);
  out.push(
    '- Betygskriterierna beskriver slutet av stadiet. Använd dem som riktning, inte som ' +
      'omdöme om eleven här och nu.'
  );
  out.push('- Citera läroplanstext ordagrant när du hänvisar till den. Formulera om bara för att förklara.');

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Sammansättning
// ---------------------------------------------------------------------------

export function buildTeachingContext(bundle: NormalizedStageCurriculum): TeachingContext {
  const units = buildTeachableUnits(bundle);

  return {
    subjectCode: bundle.subject.code,
    subjectName: bundle.subject.name,
    schoolType: bundle.schoolType,
    curriculumCode: bundle.curriculum?.code ?? null,
    stageId: bundle.stage.id,
    requestedGrade: bundle.stage.requestedGrade,
    units,
    stageAssessment: {
      assessmentYear: bundle.stage.assessmentYear,
      criteria: bundle.relevantAssessmentCriteria.atStageEnd,
      priorStageBaseline: bundle.relevantAssessmentCriteria.priorStageBaseline,
      noneForRequestedGrade: bundle.relevantAssessmentCriteria.noneForRequestedGrade,
    },
    groundedBrief: buildGroundedBrief(bundle),
    counts: {
      units: units.length,
      contentPoints: units.reduce((n, u) => n + u.contentPoints.length, 0),
      criteria: bundle.relevantAssessmentCriteria.atStageEnd.length,
    },
  };
}

/** Hämtar en enskild enhet ur kontexten. Kastar om id:t inte finns. */
export function selectUnit(context: TeachingContext, unitId: string): TeachableUnit {
  const unit = context.units.find((u) => u.id === unitId || u.id.endsWith(`/${unitId}`));
  if (!unit) {
    throw new Error(
      `Okänd enhet "${unitId}". Tillgängliga: ${context.units.map((u) => u.id).join(', ')}.`
    );
  }
  return unit;
}
