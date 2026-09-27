/**
 * Ali Swedish Tutor — steg 3: en MCP-prompt som kör ett handledarpass.
 *
 * Det här är HELA handledargränssnittet. Ingen applikation, inget elevtillstånd,
 * ingen lagring. Prompten är en instruktion till den AI-klient som är ansluten
 * till den här MCP-servern: hämta grundning med `get_tutor_teaching_context`,
 * undervisa utifrån den, och sluta där.
 *
 * Gränsdragningen är avsiktlig: Skolverket-MCP är kunskapslagret. Eleven möter
 * aldrig det här repot — eleven möter sin MCP-klient.
 */

/** Ämnen prompten känner igen, samma nycklar som handledarverktygen tar. */
const SUBJECT_LABELS: Record<string, string> = {
  svenska: 'Svenska',
  svenska_som_andrasprak: 'Svenska som andraspråk',
};

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
    'Kör ett handledarpass i svenska för en grundskoleelev, grundat i Skolverkets läroplan. ' +
    'Handledaren hämtar officiellt innehåll med get_tutor_teaching_context innan undervisningen börjar.',
  arguments: [
    {
      name: 'student_name',
      description: 'Elevens namn. Default: "Ali".',
      required: false,
    },
    {
      name: 'grade',
      description: 'Elevens årskurs. Default: 5. Måste ligga inom stadiet 4-6.',
      required: false,
    },
    {
      name: 'subject',
      description: '"svenska" eller "svenska_som_andrasprak". Default: "svenska".',
      required: false,
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
        'Språk för korta nödförklaringar när eleven kör fast. Default: "arabiska". ' +
        'Används bara undantagsvis; undervisningen sker på svenska.',
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
  const student = (args.student_name ?? 'Ali').trim() || 'Ali';
  const gradeRaw = args.grade ?? 5;
  const grade = Number.parseInt(String(gradeRaw), 10);
  if (Number.isNaN(grade)) {
    throw new Error(`grade måste vara ett tal, fick "${gradeRaw}".`);
  }

  const subject = (args.subject ?? 'svenska').trim();
  if (!(subject in SUBJECT_LABELS)) {
    throw new Error(
      `Okänt ämne "${subject}". Giltiga värden: ${Object.keys(SUBJECT_LABELS).join(', ')}.`
    );
  }
  const subjectLabel = SUBJECT_LABELS[subject];
  const fallback = (args.fallback_language ?? 'arabiska').trim() || 'arabiska';
  const unitId = args.unit_id?.trim();
  const capitalised = fallback.charAt(0).toUpperCase() + fallback.slice(1);

  // Exakt det anrop klienten ska göra, så att grundningen inte blir en gissning.
  // Nyckeln måste heta exakt som verktygets schema (`unitId`), annars ignoreras
  // den tyst och passet får hela stadiet i stället för den valda enheten.
  const toolArgs: Record<string, unknown> = { subject, grade };
  if (unitId) toolArgs.unitId = unitId;
  const toolCall = `get_tutor_teaching_context ${JSON.stringify(toolArgs)}`;

  const text = `Du är ${student}s handledare i ${subjectLabel}. ${student} går i årskurs ${grade}.

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
du får tillbaka gäller årskurs 4-6 som helhet.

- Det officiella centrala innehållet gäller årskurs 4-6.
- Årskurs ${grade} är ${student}s nuvarande årskurs, inget Skolverket har eget innehåll för.
- Hur snabbt och i vilken ordning ni går igenom 4-6-materialet är din pedagogiska
  bedömning, inte något läroplanen anger.

Säg därför ALDRIG att Skolverket anger något specifikt för årskurs ${grade}.
Betygskriterierna gäller slutet av årskurs 6 och är en riktning framåt — de är
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
- Använd de stabila id:na (t.ex. GRGRSVE01/4-6/lasa-och-skriva/3) internt när du
  väljer vad ni ska arbeta med. Läs inte upp id:n för ${student} — de är för dig.
- Övningar, exempel, meningar och texter som du hittar på är DINA, inte Skolverkets.
  Presentera dem som övningar du gjort, inte som officiellt material. Det officiella
  är det som står i \`units\` och \`stageAssessment\`.
- Citera läroplanstext ordagrant när du faktiskt hänvisar till den.

## 6. ${fallback.toUpperCase()} SOM NÖDUTGÅNG

Undervisningen sker på svenska. ${capitalised} används bara när ${student}
uttryckligen ber om det, eller tydligt inte förstår den svenska förklaringen.

Då: förklara den svåra punkten kort på ${fallback} — och gå sedan tillbaka till svenska.
Översätt inte hela passet.

## 7. SÅ HÄR AVSLUTAR DU

Avsluta med en mycket kort sammanfattning riktad till ${student}, på svenska:

- Det här övade vi på
- Det här gick bra
- Det här är bra att öva mer på

Håll den kort — några rader, inte en rapport. Spara den ingenstans och låtsas inte
att du minns den till nästa gång: det finns inget elevminne i det här steget.

Börja nu med att anropa ${toolCall}.`;

  return {
    description: `Handledarpass i ${subjectLabel} för ${student}, årskurs ${grade}, grundat i Skolverkets läroplan för årskurs 4-6.`,
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
    ],
  };
}
