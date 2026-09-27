/**
 * Verifierar att handledarkontexten inte tillför något som Skolverket inte sagt.
 *
 * Fixturerna är oredigerade API-svar (se curriculum-stage.test.ts). Inga nätanrop.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeStageCurriculum,
  type SubjectResponse,
  type CurriculumResponse,
} from '../../src/tutor/curriculum-stage.js';
import {
  buildTeachingContext,
  buildTeachableUnits,
  selectUnit,
} from '../../src/tutor/teaching-context.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = <T>(n: string): T => JSON.parse(readFileSync(join(fixtures, n), 'utf8')) as T;

const svenska = load<SubjectResponse>('GRGRSVE01.json');
const sva = load<SubjectResponse>('GRGRSVA01.json');
const lgr22 = load<CurriculumResponse>('LGR22.json');

const opts = {
  stageId: '4-6',
  requestedGrade: 5,
  schoolType: 'GR',
  apiBaseUrl: 'https://api.skolverket.se/syllabus',
};

const bundle = normalizeStageCurriculum(svenska, lgr22, opts);
const ctx = buildTeachingContext(bundle);

/**
 * Samma normalisering som modulen använder: taggar tas BORT, inte ersätts med
 * blanksteg. Skillnaden spelar roll — `samtalen <strong>väl</strong>.` blir
 * annars "väl ." i stället för "väl." och matchar då inte briefen.
 */
const plain = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/­/g, '').replace(/\s+/g, ' ').trim();

describe('undervisningsbara enheter', () => {
  it('speglar rubrikerna ur det centrala innehållet exakt', () => {
    expect(ctx.units.map((u) => u.title)).toEqual(
      bundle.centralContentForStage.headings.map((h) => h.title)
    );
  });

  it('ger varje enhet och punkt ett stabilt, härledbart id', () => {
    expect(ctx.units[0].id).toBe('GRGRSVE01/4-6/lasa-och-skriva');
    expect(ctx.units[0].contentPoints[0].id).toBe('GRGRSVE01/4-6/lasa-och-skriva/1');
    // Id:na ska vara stabila mellan körningar.
    expect(buildTeachableUnits(bundle).map((u) => u.id)).toEqual(ctx.units.map((u) => u.id));
    // Och unika.
    const ids = ctx.units.flatMap((u) => u.contentPoints.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tappar inte en enda punkt ur läroplanen', () => {
    const liInHtml = (bundle.centralContentForStage.html.match(/<li[^>]*>/g) ?? []).length;
    expect(ctx.counts.contentPoints).toBe(liInHtml);
    expect(ctx.counts.contentPoints).toBe(21);
    expect(ctx.counts.units).toBe(5);
  });

  it('återger varje punkt ordagrant ur API:ets HTML', () => {
    const source = plain(bundle.centralContentForStage.html);
    for (const u of ctx.units) {
      for (const p of u.contentPoints) {
        expect(source).toContain(p.text);
      }
    }
  });

  it('slår upp en enhet på både fullt id och kortform', () => {
    expect(selectUnit(ctx, 'GRGRSVE01/4-6/texter').title).toBe('Texter');
    expect(selectUnit(ctx, 'texter').title).toBe('Texter');
    expect(() => selectUnit(ctx, 'grammatik')).toThrow(/Okänd enhet/);
  });
});

describe('kriterier hålls isär från innehållet', () => {
  it('kopplar inte kriterier till enskilda enheter', () => {
    // Skolverket publicerar ingen sådan koppling; enheterna får inte bära någon.
    for (const u of ctx.units) {
      expect(Object.keys(u).sort()).toEqual(['contentPoints', 'id', 'title']);
    }
    for (const p of ctx.units.flatMap((u) => u.contentPoints)) {
      expect(Object.keys(p).sort()).toEqual(['id', 'text']);
    }
  });

  it('redovisar kriterierna på stadienivå med rätt år', () => {
    expect(ctx.stageAssessment.assessmentYear).toBe('6');
    expect(ctx.stageAssessment.criteria.map((c) => c.gradeStep)).toEqual(['E', 'D', 'C', 'B', 'A']);
    expect(ctx.stageAssessment.priorStageBaseline.map((c) => c.year)).toEqual(['3']);
    expect(ctx.stageAssessment.noneForRequestedGrade).toBe(true);
  });
});

describe('den grundande briefen', () => {
  const brief = ctx.groundedBrief;

  it('säger explicit att årskurs 5 inte finns i läroplanen', () => {
    expect(brief).toContain('INGET innehåll som är specifikt för årskurs 5');
    expect(brief).toContain('per stadium, inte per årskurs');
    expect(brief).toContain('inga kriterier att bedöma en elev i årskurs 5 mot');
  });

  it('förbjuder påhittade kopplingar mellan kriterier och innehåll', () => {
    expect(brief).toContain('Skolverket kopplar inte betygskriterier till enskilda punkter');
    expect(brief).toContain('Säg aldrig att Skolverket anger något specifikt för årskurs 5');
  });

  it('anger härkomst: ämneskod, version, läroplan och endpoint', () => {
    expect(brief).toContain('GRGRSVE01');
    expect(brief).toContain('LGR22');
    expect(brief).toContain(`Ämnesversion: ${bundle.subject.version}`);
    expect(brief).toContain('SKOLFS 2024:590');
    expect(brief).toContain('/v1/subjects/GRGRSVE01');
  });

  it('återger syftet och hela det centrala innehållet ordagrant', () => {
    for (const p of bundle.purpose.paragraphs) expect(brief).toContain(p);
    for (const u of ctx.units) {
      expect(brief).toContain(u.title);
      for (const p of u.contentPoints) expect(brief).toContain(p.text);
    }
  });

  it('återger betygskriterierna ordagrant', () => {
    for (const c of ctx.stageAssessment.criteria) {
      expect(brief).toContain(c.headingText);
      for (const p of c.paragraphs) expect(brief).toContain(p);
    }
  });

  it('tillför ingen läroplanstext utöver rubriker och våra egna regler', () => {
    // Varje rad som inte är en av våra egna ska gå att hitta i API-svaret.
    const official = [
      plain(bundle.purpose.html),
      plain(bundle.centralContentForStage.html),
      ...ctx.stageAssessment.criteria.map((c) => plain(c.html)),
      ...ctx.stageAssessment.priorStageBaseline.map((c) => plain(c.html)),
    ].join(' ');

    const ours = [
      // Våra egna rubriker ...
      'OM DENNA BRIEF',
      'VAD SKOLVERKET FAKTISKT ANGER',
      'REGLER FÖR HANDLEDAREN',
      'SYFTE',
      'CENTRALT INNEHÅLL',
      'BETYGSKRITERIER',
      'FÖREGÅENDE STADIUM',
      'Värdeord som Skolverket markerar',
      // ... och våra egna förklarande meningar om vad API:et saknar.
      'publicerar centralt innehåll per stadium',
      'Betygskriterier finns bara för slutet av årskurs',
    ];

    const unaccounted = brief
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      // Våra rubriker, regelpunkter och id-rader.
      .filter((l) => !l.startsWith('#') && !l.startsWith('- ') && !l.startsWith('('))
      .filter((l) => !ours.some((o) => l.includes(o)))
      // Det som återstår ska vara officiell text.
      .filter((l) => !official.includes(l))
      // Metaraden om härkomst är vår, och känns igen på ordet "ordagrant".
      .filter((l) => !l.includes('ordagrant från Skolverkets Syllabus API'));

    expect(unaccounted).toEqual([]);
  });
});

describe('svenska som andraspråk får sin egen kontext', () => {
  const svaCtx = buildTeachingContext(normalizeStageCurriculum(sva, lgr22, opts));

  it('har egna id:n och eget innehåll, men samma rubrikuppsättning', () => {
    expect(svaCtx.subjectCode).toBe('GRGRSVA01');
    expect(svaCtx.units[0].id).toBe('GRGRSVA01/4-6/lasa-och-skriva');
    expect(svaCtx.units.map((u) => u.title)).toEqual(ctx.units.map((u) => u.title));
    expect(svaCtx.counts.contentPoints).toBe(27);
    expect(svaCtx.groundedBrief).not.toBe(ctx.groundedBrief);
    expect(svaCtx.groundedBrief).toContain('Svenska som andraspråk');
  });
});
