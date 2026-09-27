/**
 * Verifierar extraktionsvägen för Ali Swedish Tutor mot verkliga API-svar.
 *
 * Fixturerna i `fixtures/` är oredigerade svar från
 * https://api.skolverket.se/syllabus/v1 (hämtade 2026-09-27, apiVersion
 * 1.16.2-SNAPSHOT). Testet gör inga nätanrop.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeStageCurriculum,
  StageNotAvailableError,
  GRUNDSKOLA_SWEDISH_SUBJECT_CODES,
  type SubjectResponse,
  type CurriculumResponse,
} from '../../src/tutor/curriculum-stage.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = <T>(name: string): T => JSON.parse(readFileSync(join(fixtures, name), 'utf8')) as T;

const svenska = load<SubjectResponse>('GRGRSVE01.json');
const sva = load<SubjectResponse>('GRGRSVA01.json');
const lgr22 = load<CurriculumResponse>('LGR22.json');

const opts = {
  stageId: '4-6',
  requestedGrade: 5,
  schoolType: 'GR',
  apiBaseUrl: 'https://api.skolverket.se/syllabus',
};

describe('Skolverkets faktiska svarsform', () => {
  it('lägger ämnet i en envelope under `subject`', () => {
    expect(svenska.subject!.code).toBe('GRGRSVE01');
    expect((svenska as unknown as Record<string, unknown>).code).toBeUndefined();
  });

  it('anger skoltyper som en array, inte en sträng', () => {
    expect(svenska.subject!.schoolTypes).toEqual(['GR', 'SAM']);
  });

  it('grupperar centralt innehåll per stadium — aldrig per årskurs', () => {
    expect(svenska.subject!.centralContents?.map((c) => c.year)).toEqual(['1-3', '4-6', '7-9']);
    for (const cc of svenska.subject!.centralContents ?? []) {
      expect(Object.keys(cc).sort()).toEqual(['text', 'year']);
      expect(cc).not.toHaveProperty('grade');
    }
  });

  it('publicerar kunskapskrav endast för årskurs 1, 3, 6 och 9', () => {
    const years = [...new Set(svenska.subject!.knowledgeRequirements?.map((k) => k.year))];
    expect(years).toEqual(['1', '3', '6', '9']);
    expect(years).not.toContain('4');
    expect(years).not.toContain('5');
  });

  it('använder `gradeStep`, inte `grade`, för betygssteg', () => {
    const y6 = svenska.subject!.knowledgeRequirements?.filter((k) => k.year === '6') ?? [];
    expect(y6.map((k) => k.gradeStep)).toEqual(['E', 'D', 'C', 'B', 'A']);
    for (const k of y6) expect(k).not.toHaveProperty('grade');
  });

  it('levererar syftet som en enda HTML-sträng, inte en lista', () => {
    expect(typeof svenska.subject!.purpose).toBe('string');
    expect(svenska.subject).not.toHaveProperty('purposes');
  });

  it('har läroplanskoden LGR22 för grundskolan', () => {
    expect(lgr22.curriculum!.code).toBe('LGR22');
    expect(lgr22.curriculum!.schoolTypes).toContain('GR');
  });
});

describe('normalizeStageCurriculum — Svenska, åk 4–6', () => {
  const b = normalizeStageCurriculum(svenska, lgr22, opts);

  it('bevarar ämnesidentiteten oförändrad', () => {
    expect(b.subject.code).toBe(GRUNDSKOLA_SWEDISH_SUBJECT_CODES.svenska);
    expect(b.subject.name).toBe('Svenska');
    expect(b.subject.designation).toBe('SV');
    expect(b.subject.version).toBe(svenska.subject!.version);
    expect(b.subject.gradeScale).toBe('A-F');
    expect(b.schoolType).toBe('GR');
    expect(b.curriculum?.code).toBe('LGR22');
  });

  it('markerar explicit att årskurs 5 inte finns i API:et', () => {
    expect(b.stage.id).toBe('4-6');
    expect(b.stage.years).toEqual([4, 5, 6]);
    expect(b.stage.requestedGrade).toBe(5);
    expect(b.stage.gradeIsExplicitInApi).toBe(false);
    expect(b.relevantAssessmentCriteria.noneForRequestedGrade).toBe(true);
  });

  it('tar syftet ur subject.purpose utan att lägga till text', () => {
    expect(b.purpose.headingText).toBe('Syfte');
    expect(b.purpose.paragraphs).toHaveLength(6);
    expect(b.purpose.paragraphs[0]).toMatch(
      /^Undervisningen i ämnet svenska ska syfta till att eleverna utvecklar kunskaper/
    );
    // Varje stycke ska gå att hitta tillbaka i den råa HTML:en.
    for (const p of b.purpose.paragraphs) {
      expect(b.purpose.html.replace(/­/g, '')).toContain(p.slice(0, 40));
    }
  });

  it('plockar exakt 4–6-blocket och dess rubriker', () => {
    const cc = b.centralContentForStage;
    expect(cc.year).toBe('4-6');
    expect(cc.sectionHeadingText).toBe('Centralt innehåll');
    expect(cc.stageHeadingText).toBe('I årskurs 4–6');
    expect(cc.headings.map((h) => h.title)).toEqual([
      'Läsa och skriva',
      'Tala, lyssna och samtala',
      'Texter',
      'Språkbruk',
      'Informationssökning och källkritik',
    ]);
    expect(cc.html).toBe(svenska.subject!.centralContents![1].text);
  });

  it('tappar inga punkter ur det centrala innehållet', () => {
    const cc = b.centralContentForStage;
    const liInHtml = (cc.html.match(/<li[^>]*>/g) ?? []).length;
    const extracted = cc.headings.reduce((n, h) => n + h.items.length, 0);
    expect(extracted).toBe(liInHtml);
    expect(extracted).toBe(21);
  });

  it('tar bort mjuka bindestreck ur den utlästa texten', () => {
    expect(b.centralContentForStage.html).toContain('­');
    const allText = b.centralContentForStage.headings.flatMap((h) => h.items).join(' ');
    expect(allText).not.toContain('­');
    expect(allText).toContain('begrepp');
  });

  it('kopplar bedömningen till åk 6 och baslinjen till åk 3', () => {
    const a = b.relevantAssessmentCriteria;
    expect(b.stage.assessmentYear).toBe('6');
    expect(a.atStageEnd.map((c) => c.gradeStep)).toEqual(['E', 'D', 'C', 'B', 'A']);
    for (const c of a.atStageEnd) expect(c.year).toBe('6');
    expect(a.priorStageBaseline.map((c) => c.year)).toEqual(['3']);
    expect(a.priorStageBaseline[0].gradeStep).toBeNull();
    expect(a.sectionHeadingText).toMatch(/BETYGSKRITERIER I ÄMNET SVENSKA/);
  });

  it('bevarar Skolverkets värdeord ur <strong>', () => {
    const e = b.relevantAssessmentCriteria.atStageEnd.find((c) => c.gradeStep === 'E')!;
    const a = b.relevantAssessmentCriteria.atStageEnd.find((c) => c.gradeStep === 'A')!;
    expect(e.headingText).toBe('Betygskriterier för betyget E i slutet av årskurs 6');
    expect(e.paragraphs).toHaveLength(5);
    expect(e.valueWords).toContain('till viss del');
    expect(a.valueWords).not.toEqual(e.valueWords);
  });

  it('redovisar härkomst för varje fält', () => {
    expect(b.provenance.subjectEndpoint).toBe('/v1/subjects/GRGRSVE01');
    expect(b.provenance.curriculumEndpoint).toBe('/v1/curriculums/LGR22');
    expect(b.provenance.availableCentralContentYears).toEqual(['1-3', '4-6', '7-9']);
    expect(b.provenance.availableKnowledgeRequirementYears).toEqual(['1', '3', '6', '9']);
    expect(Object.keys(b.provenance.fieldMap).length).toBeGreaterThan(8);
  });
});

describe('normalizeStageCurriculum — Svenska som andraspråk, åk 4–6', () => {
  const b = normalizeStageCurriculum(sva, lgr22, opts);

  it('följer samma struktur med egen ämneskod och eget innehåll', () => {
    expect(b.subject.code).toBe(GRUNDSKOLA_SWEDISH_SUBJECT_CODES.svenskaSomAndrasprak);
    expect(b.subject.name).toBe('Svenska som andraspråk');
    expect(b.stage.id).toBe('4-6');
    expect(b.centralContentForStage.headings.map((h) => h.title)).toEqual(
      normalizeStageCurriculum(svenska, lgr22, opts).centralContentForStage.headings.map(
        (h) => h.title
      )
    );
    // Samma rubriker, men innehållet är ett annat.
    expect(b.centralContentForStage.html).not.toBe(
      svenska.subject!.centralContents![1].text
    );
    expect(b.relevantAssessmentCriteria.atStageEnd).toHaveLength(5);
  });
});

describe('vägran att gissa', () => {
  it('avvisar ett stadium som API:et inte har', () => {
    expect(() => normalizeStageCurriculum(svenska, lgr22, { ...opts, stageId: '5' })).toThrow(
      StageNotAvailableError
    );
  });

  it('avvisar en årskurs utanför stadiet', () => {
    expect(() =>
      normalizeStageCurriculum(svenska, lgr22, { ...opts, requestedGrade: 8 })
    ).toThrow(/ingår inte i stadiet/);
  });

  it('avvisar en skoltyp ämnet inte gäller för', () => {
    expect(() => normalizeStageCurriculum(svenska, lgr22, { ...opts, schoolType: 'GY' })).toThrow(
      /gäller inte skoltypen GY/
    );
  });
});
