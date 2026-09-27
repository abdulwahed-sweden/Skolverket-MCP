/**
 * Verktyg för att hantera ämnen (subjects)
 */

import { z } from 'zod';
import { syllabusApi } from '../../api/syllabus-client.js';

// Zod-scheman för validering
export const searchSubjectsSchema = {
  schooltype: z.string().optional().describe('Skoltyp (t.ex. "GR" för grundskola, "GY" för gymnasium)'),
  timespan: z.enum(['LATEST', 'FUTURE', 'EXPIRED', 'MODIFIED']).default('LATEST').describe('Tidsperiod: LATEST (gällande), FUTURE (framtida), EXPIRED (utgångna), MODIFIED (ändrade)'),
  typeOfSyllabus: z.string().optional().describe('Typ av läroplan (t.ex. "SUBJECT_SYLLABUS", "COURSE_SYLLABUS")'),
  date: z.string().optional().describe('Datum i formatet YYYY-MM-DD för att hämta ämnen som var giltiga vid det datumet'),
  limit: z.number().optional().default(50).describe('Max antal resultat att returnera (default: 50, max: 200)')
};

export const getSubjectDetailsSchema = {
  code: z.string().describe('Ämneskod (t.ex. "GRGRMAT01" för matematik i grundskolan)'),
  version: z.number().optional().describe('Versionsnummer (lämna tomt för senaste versionen)'),
  date: z.string().optional().describe('Datum i formatet YYYY-MM-DD för att hämta versionen som var giltig vid det datumet')
};

export const getSubjectVersionsSchema = {
  code: z.string().describe('Ämneskod att hämta versioner för')
};

// Verktygsimplementationer
export async function searchSubjects(params: {
  schooltype?: string;
  timespan?: 'LATEST' | 'FUTURE' | 'EXPIRED' | 'MODIFIED';
  typeOfSyllabus?: string;
  date?: string;
  limit?: number;
}) {
  try {
    const result = await syllabusApi.searchSubjects(params);

    // Begränsa antal resultat för att undvika stora responses
    const maxResults = Math.min(params.limit || 50, 200);
    const allSubjects = result.subjects ?? [];
    const total = result.totalElements ?? allSubjects.length;
    const limitedSubjects = allSubjects.slice(0, maxResults);
    const hasMore = total > maxResults;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            totalElements: total,
            returned: limitedSubjects.length,
            hasMore: hasMore,
            message: hasMore ? `Visar ${limitedSubjects.length} av ${total} ämnen. Använd mer specifika filter för att begränsa resultatet.` : undefined,
            // Sökträffar är SubjectInfo: ingen beskrivning och inget centralt
            // innehåll. Använd get_subject_details för det.
            subjects: limitedSubjects.map(s => ({
              code: s.code,
              name: s.name,
              schoolTypes: s.schoolTypes,
              typeOfSyllabus: s.typeOfSyllabus,
              version: s.version,
              startDate: s.startDate,
              modifiedDate: s.modifiedDate
            }))
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Fel vid sökning av ämnen: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

export async function getSubjectDetails(params: {
  code: string;
  version?: number;
  date?: string;
}) {
  try {
    const subject = await syllabusApi.getSubject(params.code, params.version, params.date);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(subject, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Fel vid hämtning av ämnesdetaljer: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

export async function getSubjectVersions(params: {
  code: string;
}) {
  try {
    const versions = await syllabusApi.getSubjectVersions(params.code);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            code: params.code,
            totalVersions: versions.totalElements,
            // Versionslistan ligger under `subjects`, en post per version.
            versions: (versions.subjects ?? []).map(v => ({
              version: v.version,
              startDate: v.startDate,
              endDate: v.endDate,
              modifiedDate: v.modifiedDate,
              skolfsGrund: v.skolfsGrund,
              skolfsAndring: v.skolfsAndring
            }))
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Fel vid hämtning av ämnesversioner: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}
