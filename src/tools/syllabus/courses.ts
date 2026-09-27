/**
 * Verktyg för att hantera kurser (courses)
 */

import { z } from 'zod';
import { syllabusApi } from '../../api/syllabus-client.js';

// Zod-scheman för validering
export const searchCoursesSchema = {
  schooltype: z.string().optional().describe('Skoltyp (t.ex. "GY" för gymnasium)'),
  timespan: z.enum(['LATEST', 'FUTURE', 'EXPIRED', 'MODIFIED']).default('LATEST').describe('Tidsperiod: LATEST (gällande), FUTURE (framtida), EXPIRED (utgångna), MODIFIED (ändrade)'),
  date: z.string().optional().describe('Datum i formatet YYYY-MM-DD för att hämta kurser som var giltiga vid det datumet'),
  subjectCode: z.string().optional().describe('Ämneskod för att filtrera kurser'),
  limit: z.number().optional().default(50).describe('Max antal resultat att returnera (default: 50, max: 200)')
};

export const getCourseDetailsSchema = {
  code: z.string().describe('Kurskod (t.ex. "MATMAT01a" för Matematik 1a)'),
  version: z.number().optional().describe('Versionsnummer (lämna tomt för senaste versionen)'),
  date: z.string().optional().describe('Datum i formatet YYYY-MM-DD för att hämta versionen som var giltig vid det datumet')
};

export const getCourseVersionsSchema = {
  code: z.string().describe('Kurskod att hämta versioner för')
};

// Verktygsimplementationer
export async function searchCourses(params: {
  schooltype?: string;
  timespan?: 'LATEST' | 'FUTURE' | 'EXPIRED' | 'MODIFIED';
  date?: string;
  subjectCode?: string;
  limit?: number;
}) {
  try {
    const result = await syllabusApi.searchCourses(params);

    // API:et filtrerar inte på ämneskod, så det görs här via subjectParent.
    const allCourses = (result.courses ?? []).filter(
      c => !params.subjectCode || c.subjectParent?.subjectCode === params.subjectCode
    );

    // Begränsa antal resultat för att undvika stora responses
    const maxResults = Math.min(params.limit || 50, 200);
    const total = params.subjectCode
      ? allCourses.length
      : (result.totalElements ?? allCourses.length);
    const limitedCourses = allCourses.slice(0, maxResults);
    const hasMore = total > maxResults;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            totalElements: total,
            returned: limitedCourses.length,
            hasMore: hasMore,
            message: hasMore ? `Visar ${limitedCourses.length} av ${total} kurser. Använd subjectCode eller andra filter för att begränsa resultatet.` : undefined,
            // Sökträffar är CourseInfo: fälten heter courseCode/courseName och
            // ämne samt skoltyp kommer via subjectParent. Ingen beskrivning här.
            courses: limitedCourses.map(c => ({
              code: c.courseCode,
              name: c.courseName,
              points: c.coursePoints,
              version: c.version,
              subjectCode: c.subjectParent?.subjectCode,
              subjectName: c.subjectParent?.subjectName,
              schoolTypes: c.subjectParent?.schoolTypes
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
          text: `Fel vid sökning av kurser: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

export async function getCourseDetails(params: {
  code: string;
  version?: number;
  date?: string;
}) {
  try {
    const course = await syllabusApi.getCourse(params.code, params.version, params.date);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(course, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Fel vid hämtning av kursdetaljer: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

export async function getCourseVersions(params: {
  code: string;
}) {
  try {
    const versions = await syllabusApi.getCourseVersions(params.code);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            code: params.code,
            totalVersions: versions.totalElements,
            // Versionslistan ligger under `courses`, en post per version.
            versions: (versions.courses ?? []).map(v => ({
              version: v.version,
              points: v.coursePoints,
              subjectCode: v.subjectParent?.subjectCode,
              startDate: v.subjectParent?.startDate,
              endDate: v.subjectParent?.endDate,
              modifiedDate: v.subjectParent?.modifiedDate
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
          text: `Fel vid hämtning av kursversioner: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}
