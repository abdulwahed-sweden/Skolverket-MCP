/**
 * Kontrakttest för handledarprompten.
 *
 * Prompten är hela gränssnittet mot eleven i det här steget, så det som testas
 * är just de påståenden som får passet att gå fel om de försvinner: att
 * grundningen hämtas först, att stadium och årskurs hålls isär, och att
 * handledarens egna övningar inte utges för att vara Skolverkets.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTutorStudentSessionPrompt,
  tutorStudentSessionPromptDefinition as def,
} from '../../src/tutor/session-prompt.js';
import { getTutorTeachingContextSchema } from '../../src/tools/tutor/stage-curriculum.js';

/** Obligatoriska argument — prompten har inga defaults för elevuppgifter. */
const ALI = { student_name: 'Ali', grade: 5, subject: 'svenska som andraspråk' };

const promptText = (args: Record<string, unknown> = {}) =>
  buildTutorStudentSessionPrompt({ ...ALI, ...args }).messages[0].content.text;

/** Alis riktiga pass: SVA, årskurs 5. */
const base = promptText();

/** Samma elev men Svenska, för att visa att ämnena skiljer sig åt. */
const svenska = promptText({ subject: 'svenska' });

describe('promptdefinitionen', () => {
  it('heter tutor_student_session och har bara valfria argument', () => {
    expect(def.name).toBe('tutor_student_session');
    expect(def.arguments.map((a) => a.name)).toEqual([
      'student_name',
      'grade',
      'subject',
      'unit_id',
      'fallback_language',
    ]);
    // Elevuppgifter är obligatoriska — servern känner inte barnet.
    const required = def.arguments.filter((a) => a.required).map((a) => a.name);
    expect(required).toEqual(['student_name', 'grade', 'subject']);
    const optional = def.arguments.filter((a) => !a.required).map((a) => a.name);
    expect(optional).toEqual(['unit_id', 'fallback_language']);
  });

  it('nämner grundningsverktyget redan i beskrivningen', () => {
    expect(def.description).toContain('get_tutor_teaching_context');
  });

  it('utlovar inga defaultvärden för eleven', () => {
    const blob = JSON.stringify(def);
    expect(blob).not.toMatch(/Default: "Ali"/);
    expect(blob).not.toMatch(/Default: 5/);
    expect(blob).not.toMatch(/Default: "svenska"/);
    expect(blob).not.toMatch(/Default: "arabiska"/);
    expect(def.description).toContain('inget antas');
  });
});

describe('grundning hämtas före undervisning', () => {
  it('instruerar klienten att anropa get_tutor_teaching_context', () => {
    expect(base).toContain('get_tutor_teaching_context');
  });

  it('formulerar grundningsregeln som en uppmaning', () => {
    expect(base).toContain('Hitta inte på innehåll.');
    expect(base).not.toContain('Hittar du inte på innehåll.');
  });

  it('säger uttryckligen att det ska ske innan undervisningen', () => {
    expect(base).toContain('HÄMTA GRUNDNING FÖRST — INNAN DU UNDERVISAR');
    expect(base).toMatch(/Innan du säger något om ämnesinnehåll/);
  });

  it('anger exakta argument, så att anropet inte blir en gissning', () => {
    expect(base).toContain(
      'get_tutor_teaching_context {"subject":"svenska_som_andrasprak","grade":5,"stage":"4-6"}'
    );
  });

  it('avslutar med att peka tillbaka på anropet', () => {
    expect(base.trimEnd()).toMatch(
      /Börja nu med att anropa get_tutor_teaching_context \{.*\}\.$/
    );
  });

  it('skickar med unitId när passet är inriktat', () => {
    const t = promptText({ unit_id: 'lasa-och-skriva' });
    expect(t).toContain(
      'get_tutor_teaching_context {"subject":"svenska_som_andrasprak","grade":5,' +
        '"stage":"4-6","unitId":"lasa-och-skriva"}'
    );
    expect(t).toContain('passet är inriktat på "lasa-och-skriva"');
  });

  it('använder argumentnamn som verktyget faktiskt har', () => {
    // Prompten dikterar ett verkligt verktygsanrop. Stavas en nyckel fel
    // ignoreras den tyst av verktyget — passet skulle då få fel innehåll utan
    // att någon märker det. Det här fångar exakt det: `unit_id` i stället för
    // `unitId` gav hela stadiet tillbaka i stället för den valda enheten.
    const valid = new Set(Object.keys(getTutorTeachingContextSchema));
    const calls = [promptText(), promptText({ unit_id: 'texter' }), svenska].flatMap((t) =>
      [...t.matchAll(/get_tutor_teaching_context (\{[^}]*\})/g)].map((m) => JSON.parse(m[1]))
    );

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      for (const key of Object.keys(call)) {
        expect(valid, `"${key}" finns inte i verktygets schema`).toContain(key);
      }
    }
  });

  it('bäddar inte in läroplanstext i prompten', () => {
    // Innehållet ska hämtas live, inte ligga som en kopia som kan bli inaktuell.
    expect(base).not.toContain('Gemensam och enskild läsning');
    expect(base).not.toContain('Betygskriterier för betyget E');
    expect(base.length).toBeLessThan(6000);
  });
});

describe('stadium kontra årskurs bevaras', () => {
  it('slår fast att innehållet gäller årskurs 4-6', () => {
    expect(base).toContain('per STADIUM, inte per årskurs');
    expect(base).toContain('Det officiella centrala innehållet gäller årskurs 4-6.');
  });

  it('säger att årskurs 5 är elevens årskurs, inte en läroplansnivå', () => {
    expect(base).toContain('Årskurs 5 är Alis nuvarande årskurs');
    expect(base).toMatch(/inget Skolverket har eget innehåll för/);
  });

  it('kallar takten pedagogisk bedömning, inte läroplan', () => {
    expect(base).toMatch(/din pedagogiska\s+bedömning, inte något läroplanen anger/);
  });

  it('förbjuder påståenden om årskursspecifikt innehåll', () => {
    expect(base).toContain('ALDRIG att Skolverket anger något specifikt för årskurs 5');
  });

  it('ramar in kriterierna som riktning, inte omdöme', () => {
    expect(base).toMatch(/gäller slutet av årskurs 6/);
    expect(base).toMatch(/inte ett omdöme om Ali i dag/);
  });

  it('förbjuder påhittade kopplingar mellan kriterier och innehåll', () => {
    expect(base).toContain(
      'Skolverket kopplar inte betygskriterier till enskilda punkter'
    );
    expect(base).toContain('Hitta inte på sådana kopplingar.');
  });

  it('följer med när årskursen ändras inom stadiet', () => {
    const t = promptText({ grade: 4 });
    expect(t).toContain('Årskurs 4 är Alis nuvarande årskurs');
    expect(t).toContain('ALDRIG att Skolverket anger något specifikt för årskurs 4');
    // Stadiet är fortfarande 4-6.
    expect(t).toContain('Det officiella centrala innehållet gäller årskurs 4-6.');
  });

  it('härleder stadiet ur årskursen i stället för att anta 4-6', () => {
    const y2 = promptText({ grade: 2 });
    expect(y2).toContain('Det officiella centrala innehållet gäller årskurs 1-3.');
    expect(y2).toContain('"stage":"1-3"');
    expect(y2).toContain('Betygskriterierna gäller slutet av årskurs 3');

    const y8 = promptText({ grade: 8 });
    expect(y8).toContain('Det officiella centrala innehållet gäller årskurs 7-9.');
    expect(y8).toContain('"stage":"7-9"');
    expect(y8).toContain('Betygskriterierna gäller slutet av årskurs 9');
  });

  it('avvisar en årskurs utanför grundskolan', () => {
    expect(() => promptText({ grade: 11 })).toThrow(/finns inte i grundskolan/);
  });
});

describe('handledarens egna övningar skiljs från officiellt material', () => {
  it('slår fast att påhittade övningar är handledarens', () => {
    expect(base).toMatch(
      /Övningar, exempel, meningar och texter som du hittar på är DINA, inte Skolverkets/
    );
  });

  it('säger hur de ska presenteras', () => {
    expect(base).toContain('inte som officiellt material');
  });

  it('pekar ut vad som faktiskt är officiellt', () => {
    expect(base).toMatch(/Det officiella\s+är det som står i `units` och `stageAssessment`/);
  });
});

describe('undervisningsformen', () => {
  it('kräver svenska och enkel nivå', () => {
    expect(base).toContain('Undervisa på svenska');
    expect(base).toContain('enkel svenska som passar en elev i årskurs 5');
  });

  it('kräver en fråga i taget och att handledaren väntar', () => {
    expect(base).toContain('Ställ EN fråga i taget');
    expect(base).toContain('Vänta på Alis svar');
  });

  it('kräver ledtråd före svar, och nytt försök efter förklaring', () => {
    expect(base).toContain('Avslöja inte svaret direkt');
    expect(base).toMatch(/ge först en ledtråd/);
    expect(base).toMatch(/förklara kort, och låt Ali försöka igen/);
  });

  it('kräver anpassad svårighetsgrad, uppmuntrande ton och korthet', () => {
    expect(base).toContain('Anpassa svårighetsgraden');
    expect(base).toContain('uppmuntrande men inte barnslig');
    expect(base).toContain('Inga långa föreläsningar');
  });

  it('anger 20 minuter som känsla, inte som klocka', () => {
    expect(base).toContain('ungefär 20 minuter');
    expect(base).toMatch(/inte\s+som en klocka/);
    expect(base).toContain('räkna inte minuter');
  });

  it('kräver hälsning, dagens ämne och en diagnosfråga före genomgång', () => {
    expect(base).toContain('Hälsa kort på Ali');
    expect(base).toContain('vad ni ska arbeta med i dag');
    expect(base).toContain('Ställ EN diagnostisk fråga innan du förklarar något mer');
    expect(base).toContain('Börja alltså inte\nmed en genomgång');
  });

  it('håller id:n internt', () => {
    expect(base).toContain('Läs inte upp id:n för Ali');
  });
});

describe('fallbackspråk', () => {
  it('antar inget reservspråk när inget anges', () => {
    // Arabiska var tidigare default. Servern känner inte elevens språk.
    expect(base).not.toContain('ARABISKA');
    expect(base).not.toContain('arabiska');
    expect(base).toContain('## 6. SPRÅK');
    expect(base).toContain('Inget reservspråk är angivet för Ali');
    expect(base).toContain('byt inte språk på eget bevåg');
  });

  it('använder det språk som faktiskt anges', () => {
    const t = promptText({ fallback_language: 'arabiska' });
    expect(t).toContain('ARABISKA SOM NÖDUTGÅNG');
    expect(t).toContain('Undervisningen sker på svenska. Arabiska används bara när Ali');
    expect(t).toMatch(/uttryckligen ber om det, eller tydligt inte förstår/);
    expect(t).toMatch(/gå sedan tillbaka till svenska/);
    expect(t).toContain('Översätt inte hela passet');
  });

  it('går att byta ut', () => {
    const t = promptText({ fallback_language: 'engelska' });
    expect(t).toContain('ENGELSKA SOM NÖDUTGÅNG');
    expect(t).toContain('Engelska används bara när Ali');
    expect(t).toContain('kort på engelska');
    expect(t).not.toContain('ARABISKA');
  });
});

describe('avslutning utan lagring', () => {
  it('kräver en kort trepunktsrecap', () => {
    expect(base).toContain('Det här övade vi på');
    expect(base).toContain('Det här gick bra');
    expect(base).toContain('Det här är bra att öva mer på');
  });

  it('förbjuder att recapen sparas eller låtsas minnas', () => {
    expect(base).toContain('Spara den ingenstans');
    expect(base).toMatch(/det finns inget elevminne i det här steget/);
  });
});

describe('obligatoriska argument', () => {
  it('avvisar ett anrop helt utan argument', () => {
    expect(() => buildTutorStudentSessionPrompt()).toThrow(/student_name måste anges/);
    expect(() => buildTutorStudentSessionPrompt({})).toThrow(/student_name måste anges/);
  });

  it('avvisar när elevens namn saknas', () => {
    expect(() =>
      buildTutorStudentSessionPrompt({ grade: 5, subject: 'svenska som andraspråk' })
    ).toThrow(/student_name måste anges/);
    expect(() => promptText({ student_name: '   ' })).toThrow(/student_name måste anges/);
  });

  it('avvisar när årskursen saknas', () => {
    expect(() =>
      buildTutorStudentSessionPrompt({
        student_name: 'Ali',
        subject: 'svenska som andraspråk',
      })
    ).toThrow(/grade måste anges/);
  });

  it('avvisar när ämnet saknas — ingen tyst läroplan', () => {
    expect(() =>
      buildTutorStudentSessionPrompt({ student_name: 'Ali', grade: 5 })
    ).toThrow(/Ämne måste anges explicit/);
    expect(() => promptText({ subject: '' })).toThrow(/Ämne måste anges explicit/);
    // Felet ska förklara varför, inte bara att.
    expect(() => promptText({ subject: undefined })).toThrow(/giltig men fel läroplan/);
  });

  it('vägrar okänt ämne i stället för att gissa', () => {
    expect(() => promptText({ subject: 'matematik' })).toThrow(/Okänt ämne "matematik"/);
    expect(() => promptText({ subject: 'matematik' })).toThrow(/gissas aldrig/);
  });

  it('vägrar en årskurs som inte är ett tal', () => {
    expect(() => promptText({ grade: 'femman' })).toThrow(/grade måste vara ett tal/);
  });

  it('tar emot grade som sträng, som MCP-argument kommer in', () => {
    expect(promptText({ grade: '6' })).toContain('Årskurs 6 är Alis nuvarande årskurs');
  });

  it('byter elev och ämne', () => {
    const t = promptText({ student_name: 'Noor', subject: 'svenska' });
    expect(t).toContain('Noors handledare i Svenska.');
    expect(t).toContain('"subject":"svenska"');
    expect(t).not.toContain('Ali');
  });
});
