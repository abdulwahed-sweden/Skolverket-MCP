/**
 * MCP-verktyg för Ali Swedish Tutor.
 *
 * Tunn inpackning runt `src/tutor/`. All hämtning går via den befintliga
 * `syllabusApi`-klienten; inget nytt datakälla införs här.
 */

import { z } from 'zod';
import { fetchStageCurriculum } from '../../tutor/curriculum-stage.js';
import { buildTeachingContext, selectUnit } from '../../tutor/teaching-context.js';
import {
  resolveSubject,
  gradesInStage,
  MissingSubjectError,
  ACCEPTED_SUBJECT_ALIASES,
} from '../../tutor/subjects.js';

const sharedSchema = {
  // Ingen default: ett underförstått ämne ger giltig men FEL läroplan, vilket
  // ändrar vad eleven undervisas i utan att något fel syns.
  subject: z
    .string()
    .optional()
    .describe(
      'Ämne. Måste anges om `subjectCode` utelämnas — ämnet gissas aldrig. ' +
        `Accepterade värden: ${ACCEPTED_SUBJECT_ALIASES.join(', ')}.`
    ),
  subjectCode: z
    .string()
    .optional()
    .describe(
      'Ämneskod direkt, t.ex. "GRGRMAT01". Används i stället för `subject` om den anges. ' +
        'Fungerar för alla grundskoleämnen, inte bara svenska.'
    ),
  schoolType: z.string().optional().default('GR').describe('Skoltyp. Default "GR" (grundskola).'),
  stage: z
    .string()
    .optional()
    .default('4-6')
    .describe(
      'Stadium precis som Skolverket anger det i centralContents[].year: "1-3", "4-6" eller "7-9". ' +
        'Enskilda årskurser finns inte i API:et.'
    ),
  grade: z
    .number()
    .optional()
    .describe(
      'Årskursen undervisningen gäller. Måste ligga inom `stage`. Default följer stadiets ' +
        'första årskurs om den utelämnas. Påverkar inte vilket innehåll som hämtas — ' +
        'Skolverket har bara stadieinnehåll — men redovisas explicit i svaret.'
    ),
  date: z
    .string()
    .optional()
    .describe('Datum YYYY-MM-DD för att hämta den version som gällde då.'),
};

export const getTutorStageCurriculumSchema = { ...sharedSchema };

export const getTutorTeachingContextSchema = {
  ...sharedSchema,
  unitId: z
    .string()
    .optional()
    .describe(
      'Begränsa svaret till en enhet ur det centrala innehållet, t.ex. ' +
        '"GRGRSVE01/4-6/lasa-och-skriva" eller kortformen "lasa-och-skriva".'
    ),
  includeBrief: z
    .boolean()
    .optional()
    .default(true)
    .describe('Ta med den grundande textbriefen. Sätt false för att bara få strukturen.'),
};

interface SharedParams {
  subject?: string;
  subjectCode?: string;
  schoolType?: string;
  stage?: string;
  grade?: number;
  date?: string;
}

/**
 * En ämneskod krävs alltid. `subjectCode` går före `subject`; saknas båda
 * kastas ett fel i stället för att ett ämne väljs åt anroparen.
 */
function resolveSubjectCode(params: SharedParams): string {
  if (params.subjectCode?.trim()) return params.subjectCode.trim();
  if (!params.subject?.trim()) throw new MissingSubjectError();
  return resolveSubject(params.subject).code;
}

async function load(params: SharedParams) {
  const stageId = params.stage ?? '4-6';
  return fetchStageCurriculum({
    subjectCode: resolveSubjectCode(params),
    schoolType: params.schoolType ?? 'GR',
    stageId,
    // Utan angiven årskurs används stadiets första, så att svaret aldrig
    // påstår en årskurs som anroparen inte bett om.
    requestedGrade: params.grade ?? gradesInStage(stageId)[0] ?? 1,
    date: params.date,
  });
}

function fail(prefix: string, error: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}

/**
 * Normaliserad, stadieavgränsad läroplan för ett ämne — med härkomst för varje fält.
 */
export async function getTutorStageCurriculum(params: SharedParams) {
  try {
    const bundle = await load(params);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(bundle, null, 2) }],
    };
  } catch (error) {
    return fail('Fel vid hämtning av stadieläroplan', error);
  }
}

/**
 * Samma data, men uppdelad i undervisningsbara enheter plus en grundande brief.
 */
export async function getTutorTeachingContext(
  params: SharedParams & { unitId?: string; includeBrief?: boolean }
) {
  try {
    const bundle = await load(params);
    const context = buildTeachingContext(bundle);
    const includeBrief = params.includeBrief ?? true;

    const payload: Record<string, unknown> = {
      subjectCode: context.subjectCode,
      subjectName: context.subjectName,
      schoolType: context.schoolType,
      curriculumCode: context.curriculumCode,
      stage: {
        id: context.stageId,
        years: bundle.stage.years,
        requestedGrade: context.requestedGrade,
        // Den avgörande avgränsningen, med i varje svar.
        gradeIsExplicitInApi: bundle.stage.gradeIsExplicitInApi,
        assessmentYear: context.stageAssessment.assessmentYear,
      },
      units: params.unitId ? [selectUnit(context, params.unitId)] : context.units,
      stageAssessment: context.stageAssessment,
      counts: context.counts,
      provenance: bundle.provenance,
    };

    if (includeBrief) payload.groundedBrief = context.groundedBrief;

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    };
  } catch (error) {
    return fail('Fel vid uppbyggnad av handledarkontext', error);
  }
}
