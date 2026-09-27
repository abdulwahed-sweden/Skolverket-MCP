/**
 * Handledarpass som MCP-prompt.
 *
 * Det här är HELA handledargränssnittet. Ingen applikation, inget elevtillstånd,
 * ingen lagring. Prompten är en instruktion till den AI-klient som är ansluten
 * till den här MCP-servern: hämta grundning med `get_tutor_teaching_context`,
 * undervisa utifrån den, och sluta där.
 *
 * GRÄNSDRAGNING: Skolverket-MCP kan läroplan. Det känner inte barnet.
 * Därför finns inga defaultvärden för elev, årskurs, ämne eller reservspråk —
 * de tillhör den som anropar. En utelämnad elevuppgift gör det bara lite
 * krångligare för anroparen; ett underförstått ämne ändrar vad barnet
 * undervisas i. Korrekthet vinner.
 */

import {
  resolveSubject,
  stageForGrade,
  gradesInStage,
  ACCEPTED_SUBJECT_ALIASES,
} from './subjects.js';

export interface TutorSessionArgs {
  student_name?: string;
  grade?: string | number;
  subject?: string;
  unit_id?: string;
  fallback_language?: string;
}

/** Posten som `prompts/list` visar. */
export const tutorStudentSessionPromptDefinition = {
  name: 'tutor_student_session',
  description:
    'Kör ett handledarpass för en grundskoleelev, grundat i Skolverkets läroplan. ' +
    'Handledaren hämtar officiellt innehåll med get_tutor_teaching_context innan ' +
    'undervisningen börjar. Elev, årskurs och ämne måste anges — inget antas.',
  arguments: [
    {
      name: 'student_name',
      description: 'Elevens namn. Obligatoriskt — servern känner inte eleven.',
      required: true,
    },
    {
      name: 'grade',
      description:
        'Elevens årskurs (1-9). Obligatoriskt. Avgör vilket stadium som hämtas: ' +
        'årskurs 1-3 → stadiet "1-3", 4-6 → "4-6", 7-9 → "7-9".',
      required: true,
    },
    {
      name: 'subject',
      description:
        'Obligatoriskt — ämnet gissas aldrig, eftersom fel ämne ger fel läroplan. ' +
        `Accepterade värden: ${ACCEPTED_SUBJECT_ALIASES.join(', ')}.`,
      required: true,
    },
    {
      name: 'unit_id',
      description:
        'Valfri enhet ur det centrala innehållet att fokusera passet på, ' +
        't.ex. "lasa-och-skriva". Utelämnas den väljer handledaren själv.',
      required: false,
    },
    {
      name: 'fallback_language',
      description:
        'Valfritt språk för korta nödförklaringar när eleven kör fast. ' +
        'Utelämnas det sker hela passet på undervisningsspråket — ' +
        'inget reservspråk antas.',
      required: false,
    },
  ],
};

/**
 * Bygger prompttexten. Allt läroplansinnehåll saknas med avsikt — det hämtar
 * klienten själv via verktyget, så att texten aldrig blir en inaktuell kopia
 * av Skolverkets data.
 */
export function buildTutorStudentSessionPrompt(args: TutorSessionArgs = {}) {
  // Obligatoriska elevuppgifter. Inga defaults: se gränsdragningen överst.
  const student = args.student_name?.trim();
  if (!student) {
    throw new Error(
      'student_name måste anges. Servern känner inte eleven och antar inget namn.'
    );
  }

  if (args.grade === undefined || args.grade === null || String(args.grade).trim() === '') {
    throw new Error(
      'grade måste anges. Årskursen avgör vilket stadium som hämtas och antas aldrig.'
    );
  }
  const grade = Number.parseInt(String(args.grade), 10);
  if (Number.isNaN(grade)) {
    throw new Error(`grade måste vara ett tal, fick "${args.grade}".`);
  }

  // Kastar både när ämnet saknas och när det är okänt — aldrig en gissning.
  const subject = resolveSubject(args.subject);

  // Stadiet följer av årskursen; det är Skolverkets egen indelning, inte ett val.
  const stage = stageForGrade(grade);
  const stageGrades = gradesInStage(stage);

  // Reservspråk är valfritt och har ingen default. Saknas det körs hela passet
  // på svenska i stället för att ett språk hittas på åt eleven.
  const fallback = args.fallback_language?.trim() || undefined;
  const unitId = args.unit_id?.trim();

  // Exakt det anrop klienten ska göra, så att grundningen inte blir en gissning.
  // Nycklarna måste heta exakt som verktygets schema, annars ignoreras de tyst.
  const toolArgs: Record<string, unknown> = {
    subject: subject.key,
    grade,
    stage,
  };
  if (unitId) toolArgs.unitId = unitId;
  const toolCall = `get_tutor_teaching_context ${JSON.stringify(toolArgs)}`;

  // Utan angivet reservspråk sägs uttryckligen att passet hålls på svenska,
  // i stället för att handledaren gissar vilket språk eleven kan.
  const capitalised = fallback
    ? fallback.charAt(0).toUpperCase() + fallback.slice(1)
    : '';
  const fallbackSection = fallback
    ? `## 6. ${fallback.toUpperCase()} SOM NÖDUTGÅNG

Undervisningen sker på svenska. ${capitalised} används bara när ${student}
uttryckligen ber om det, eller tydligt inte förstår den svenska förklaringen.

Då: förklara den svåra punkten kort på ${fallback} — och gå sedan tillbaka till svenska.
Översätt inte hela passet.
`
    : `## 6. SPRÅK

Hela passet hålls på svenska. Inget reservspråk är angivet för ${student}, så
använd inget: byt inte språk på eget bevåg. Förstår ${student} inte en förklaring,
förenkla den svenska i stället.
`;

  const text = `Du är ${student}s handledare i ${subject.label}. ${student} går i årskurs ${grade}.

## 1. HÄMTA GRUNDNING FÖRST — INNAN DU UNDERVISAR

Innan du säger något om ämnesinnehåll: anropa verktyget

    ${toolCall}

Svaret innehåller Skolverkets officiella läroplan för stadiet: \`units\` (rubriker
ur det centrala innehållet med sina punkter och stabila id:n), \`stageAssessment\`
(betygskriterier för stadiets slutår) och \`groundedBrief\` (samma text ordagrant,
med härkomst). Undervisa bara utifrån det svaret.

Hitta inte på innehåll. Behöver du något som inte finns i \`units\`, säg att det
ligger utanför läroplanen för det här stadiet.

## 2. ÅRSKURS KONTRA STADIUM — LÄS DET HÄR NOGA

Skolverket publicerar centralt innehåll per STADIUM, inte per årskurs. Det innehåll
du får tillbaka gäller årskurs ${stage} som helhet.

- Det officiella centrala innehållet gäller årskurs ${stage}.
- Årskurs ${grade} är ${student}s nuvarande årskurs, inget Skolverket har eget innehåll för.
- Hur snabbt och i vilken ordning ni går igenom ${stage}-materialet är din pedagogiska
  bedömning, inte något läroplanen anger.

Säg därför ALDRIG att Skolverket anger något specifikt för årskurs ${grade}.
Betygskriterierna gäller slutet av årskurs ${stageGrades[stageGrades.length - 1]} och är en riktning framåt — de är
inte ett omdöme om ${student} i dag.

Skolverket kopplar inte betygskriterier till enskilda punkter i det centrala
innehållet. Hitta inte på sådana kopplingar.

## 3. SÅ HÄR UNDERVISAR DU

- Undervisa på svenska. Använd enkel svenska som passar en elev i årskurs ${grade}.
- Ställ EN fråga i taget. Vänta på ${student}s svar innan du går vidare.
- Avslöja inte svaret direkt. Är svaret fel: ge först en ledtråd.
- Är det fortfarande fel: förklara kort, och låt ${student} försöka igen.
- Anpassa svårighetsgraden efter hur det går — höj när det går lätt, sänk när det tar emot.
- Var uppmuntrande men inte barnslig. ${student} är inte ett litet barn.
- Håll dig kort. Inga långa föreläsningar — det här är ett samtal.

Ett pass brukar ta ungefär 20 minuter. Använd det som känsla för omfattning, inte
som en klocka: räkna inte minuter och avbryt inte mitt i ett resonemang.

## 4. SÅ HÄR BÖRJAR DU

1. Hälsa kort på ${student}.
2. Säg på enkel svenska vad ni ska arbeta med i dag.
3. Ställ EN diagnostisk fråga innan du förklarar något mer.

Diagnosfrågan finns för att du ska få veta var ${student} står. Börja alltså inte
med en genomgång.

## 5. UNDER PASSET

- Håll dig till de \`units\` du fick från verktyget${unitId ? ` (passet är inriktat på "${unitId}")` : ''}.
- Använd de stabila id:na (t.ex. ${subject.code}/${stage}/lasa-och-skriva/3) internt när du
  väljer vad ni ska arbeta med. Läs inte upp id:n för ${student} — de är för dig.
- Övningar, exempel, meningar och texter som du hittar på är DINA, inte Skolverkets.
  Presentera dem som övningar du gjort, inte som officiellt material. Det officiella
  är det som står i \`units\` och \`stageAssessment\`.
- Citera läroplanstext ordagrant när du faktiskt hänvisar till den.

${fallbackSection}
## 7. SÅ HÄR AVSLUTAR DU

Avsluta med en mycket kort sammanfattning riktad till ${student}, på svenska:

- Det här övade vi på
- Det här gick bra
- Det här är bra att öva mer på

Håll den kort — några rader, inte en rapport. Spara den ingenstans och låtsas inte
att du minns den till nästa gång: det finns inget elevminne i det här steget.

Börja nu med att anropa ${toolCall}.`;

  return {
    description:
      `Handledarpass i ${subject.label} (${subject.code}) för ${student}, årskurs ${grade}, ` +
      `grundat i Skolverkets läroplan för årskurs ${stage}.`,
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
    ],
  };
}
