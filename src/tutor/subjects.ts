/**
 * Ämnesuppslagning för handledarlagret.
 *
 * En enda tabell, delad av MCP-prompten och handledarverktygen, så att ett
 * ämnesnamn inte kan betyda olika saker beroende på vilken väg anropet tog.
 *
 * VARFÖR DET HÄR ÄR VIKTIGT: ett tyst fel här ger giltig men FEL läroplan.
 * Eleven får då undervisning i ett annat ämne än sitt eget, utan att något
 * felmeddelande syns. Därför finns ingen default och ingen gissning: okänt
 * ämne avvisas, och saknat ämne avvisas.
 *
 * Alias är en explicit lista, inte fuzzy matchning. `SV` och `SVA` är
 * Skolverkets egna beteckningar (fältet `designation`), inte påhittade kortnamn.
 */

/** Kanoniska ämnesnycklar. Samma värden som verktygens `subject`-parameter. */
export type TutorSubjectKey = 'svenska' | 'svenska_som_andrasprak';

export interface TutorSubject {
  key: TutorSubjectKey;
  /** Skolverkets ämneskod. */
  code: string;
  /** Skolverkets ämnesnamn, för visning. */
  label: string;
}

const SUBJECTS: Record<TutorSubjectKey, TutorSubject> = {
  svenska: { key: 'svenska', code: 'GRGRSVE01', label: 'Svenska' },
  svenska_som_andrasprak: {
    key: 'svenska_som_andrasprak',
    code: 'GRGRSVA01',
    label: 'Svenska som andraspråk',
  },
};

/**
 * Accepterade stavningar. Nyckeln är normaliserad (gemener, enkla mellanslag).
 * Både mellanslags- och understrecksform finns med, liksom ämneskod och
 * Skolverkets beteckning.
 */
const ALIASES: Record<string, TutorSubjectKey> = {
  // Svenska
  svenska: 'svenska',
  sv: 'svenska',
  grgrsve01: 'svenska',

  // Svenska som andraspråk
  'svenska som andraspråk': 'svenska_som_andrasprak',
  'svenska som andrasprak': 'svenska_som_andrasprak',
  svenska_som_andraspråk: 'svenska_som_andrasprak',
  svenska_som_andrasprak: 'svenska_som_andrasprak',
  sva: 'svenska_som_andrasprak',
  grgrsva01: 'svenska_som_andrasprak',
};

/** Gemener, trimmat, upprepade mellanslag hopslagna. Ingen annan tolkning. */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Stavningarna som accepteras, för felmeddelanden och dokumentation. */
export const ACCEPTED_SUBJECT_ALIASES = Object.keys(ALIASES);

export class UnknownSubjectError extends Error {
  constructor(raw: string) {
    super(
      `Okänt ämne "${raw}". Accepterade värden: ${ACCEPTED_SUBJECT_ALIASES.join(', ')}. ` +
        `Ämnet gissas aldrig — fel ämne ger fel läroplan.`
    );
    this.name = 'UnknownSubjectError';
  }
}

export class MissingSubjectError extends Error {
  constructor() {
    super(
      `Ämne måste anges explicit. Det finns ingen default: ett underförstått ämne ` +
        `skulle ge giltig men fel läroplan. Accepterade värden: ` +
        `${ACCEPTED_SUBJECT_ALIASES.join(', ')}.`
    );
    this.name = 'MissingSubjectError';
  }
}

/**
 * Slår upp ett ämne. Kastar hellre än gissar — både när ämnet saknas och när
 * det är okänt.
 */
export function resolveSubject(raw: string | undefined | null): TutorSubject {
  if (raw === undefined || raw === null || raw.trim() === '') {
    throw new MissingSubjectError();
  }
  const key = ALIASES[normalize(raw)];
  if (!key) throw new UnknownSubjectError(raw);
  return SUBJECTS[key];
}

// ---------------------------------------------------------------------------
// Stadier
// ---------------------------------------------------------------------------

/**
 * Grundskolans stadieindelning, så som Skolverket publicerar centralt innehåll
 * (`centralContents[].year`). Inte en pedagogisk tolkning — det är de enda
 * värden API:et använder.
 */
const STAGES: { id: string; grades: number[] }[] = [
  { id: '1-3', grades: [1, 2, 3] },
  { id: '4-6', grades: [4, 5, 6] },
  { id: '7-9', grades: [7, 8, 9] },
];

export class GradeOutsideCompulsorySchoolError extends Error {
  constructor(grade: number) {
    super(
      `Årskurs ${grade} finns inte i grundskolan. Skolverket publicerar ` +
        `centralt innehåll för stadierna ${STAGES.map((s) => s.id).join(', ')} ` +
        `(årskurs 1-9).`
    );
    this.name = 'GradeOutsideCompulsorySchoolError';
  }
}

/** Stadiet en årskurs ligger i. Kastar för årskurser utanför grundskolan. */
export function stageForGrade(grade: number): string {
  const stage = STAGES.find((s) => s.grades.includes(grade));
  if (!stage) throw new GradeOutsideCompulsorySchoolError(grade);
  return stage.id;
}

/** Årskurserna i ett stadium, t.ex. "4-6" → [4, 5, 6]. */
export function gradesInStage(stageId: string): number[] {
  return STAGES.find((s) => s.id === stageId)?.grades ?? [];
}
