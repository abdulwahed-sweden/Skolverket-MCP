/**
 * API-klient för Skolverkets Läroplan API
 */

import { BaseApiClient } from './base-client.js';
import { config } from '../config.js';
import type {
  SubjectsResponse,
  SubjectResponse,
  CoursesResponse,
  CourseResponse,
  ProgramsResponse,
  ProgramResponse,
  CurriculumsResponse,
  CurriculumResponse,
  SubjectSearchParams,
  CourseSearchParams,
  ProgramSearchParams,
  CurriculumSearchParams,
  StudyPathSearchParams,
  SchoolType,
  SchoolTypesResponse,
  TypeOfSyllabus,
  TypeOfSyllabusResponse,
  SubjectAndCourseCode,
  SubjectAndCourseCodesResponse,
  StudyPathCode,
  StudyPathCodesResponse,
  ApiInfo
} from '../types/syllabus.js';

export class SyllabusApiClient extends BaseApiClient {
  constructor() {
    super({
      baseURL: config.syllabusApiBaseUrl,
      userAgent: 'skolverket-mcp/2.1.0',
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      maxConcurrent: config.maxConcurrent,
      apiKey: config.apiKey,
      authHeader: config.authHeader,
    });
  }

  // Ämnen (Subjects)
  async searchSubjects(params: SubjectSearchParams = {}): Promise<SubjectsResponse> {
    return this.get<SubjectsResponse>('/v1/subjects', params);
  }

  /** Svaret är en envelope: ämnet ligger under `subject`. */
  async getSubject(code: string, version?: number, date?: string): Promise<SubjectResponse> {
    const url = version
      ? `/v1/subjects/${code}/versions/${version}`
      : `/v1/subjects/${code}`;
    const params = date ? { date } : undefined;
    return this.get<SubjectResponse>(url, params);
  }

  /** Versionslistan använder samma form som sökningen — nyckeln är `subjects`. */
  async getSubjectVersions(code: string): Promise<SubjectsResponse> {
    return this.get<SubjectsResponse>(`/v1/subjects/${code}/versions`);
  }

  // Kurser (Courses)
  async searchCourses(params: CourseSearchParams = {}): Promise<CoursesResponse> {
    return this.get<CoursesResponse>('/v1/courses', params);
  }

  /** Svaret är en envelope: kursen ligger under `course`. */
  async getCourse(code: string, version?: number, date?: string): Promise<CourseResponse> {
    const url = version
      ? `/v1/courses/${code}/versions/${version}`
      : `/v1/courses/${code}`;
    const params = date ? { date } : undefined;
    return this.get<CourseResponse>(url, params);
  }

  /** Versionslistan använder samma form som sökningen — nyckeln är `courses`. */
  async getCourseVersions(code: string): Promise<CoursesResponse> {
    return this.get<CoursesResponse>(`/v1/courses/${code}/versions`);
  }

  // Program (Programs)
  async searchPrograms(params: ProgramSearchParams = {}): Promise<ProgramsResponse> {
    return this.get<ProgramsResponse>('/v1/programs', params);
  }

  /** Svaret är en envelope: programmet ligger under `program`. */
  async getProgram(code: string, version?: number, date?: string): Promise<ProgramResponse> {
    const url = version
      ? `/v1/programs/${code}/versions/${version}`
      : `/v1/programs/${code}`;
    const params = date ? { date } : undefined;
    return this.get<ProgramResponse>(url, params);
  }

  /** Versionslistan använder samma form som sökningen — nyckeln är `programs`. */
  async getProgramVersions(code: string): Promise<ProgramsResponse> {
    return this.get<ProgramsResponse>(`/v1/programs/${code}/versions`);
  }

  // Läroplaner (Curriculums)
  async searchCurriculums(params: CurriculumSearchParams = {}): Promise<CurriculumsResponse> {
    return this.get<CurriculumsResponse>('/v1/curriculums', params);
  }

  /** Svaret är en envelope: läroplanen ligger under `curriculum`. */
  async getCurriculum(code: string, version?: number, date?: string): Promise<CurriculumResponse> {
    const url = version
      ? `/v1/curriculums/${code}/versions/${version}`
      : `/v1/curriculums/${code}`;
    const params = date ? { date } : undefined;
    return this.get<CurriculumResponse>(url, params);
  }

  /** Versionslistan använder samma form som sökningen — nyckeln är `curriculums`. */
  async getCurriculumVersions(code: string): Promise<CurriculumsResponse> {
    return this.get<CurriculumsResponse>(`/v1/curriculums/${code}/versions`);
  }

  // Värdesamlingar (Value Store) - använder caching för statiska värden
  async getSchoolTypes(): Promise<SchoolType[]> {
    const response = await this.getCached<SchoolTypesResponse>(
      '/v1/valuestore/schooltypes',
      undefined,
      86400000 // 24 timmar cache
    );
    return response.schoolTypes || [];
  }

  async getExpiredSchoolTypes(): Promise<SchoolType[]> {
    const response = await this.getCached<SchoolTypesResponse>(
      '/v1/valuestore/schooltypes/expired',
      undefined,
      86400000 // 24 timmar cache
    );
    return response.schoolTypes || [];
  }

  async getTypesOfSyllabus(): Promise<TypeOfSyllabus[]> {
    // Nyckeln i svaret heter `typeOfSyllabusList`.
    const response = await this.getCached<TypeOfSyllabusResponse>(
      '/v1/valuestore/typeofsyllabus',
      undefined,
      86400000 // 24 timmar cache
    );
    return response.typeOfSyllabusList || [];
  }

  async getSubjectAndCourseCodes(): Promise<SubjectAndCourseCode[]> {
    const response = await this.getCached<SubjectAndCourseCodesResponse>(
      '/v1/valuestore/subjectandcoursecodes',
      undefined,
      86400000 // 24 timmar cache
    );
    return response.codes || [];
  }

  async getStudyPathCodes(params: StudyPathSearchParams = {}): Promise<StudyPathCode[]> {
    // Nyckeln i svaret heter `codes`, inte `studyPaths`.
    const response = await this.getCached<StudyPathCodesResponse>(
      '/v1/valuestore/studypathcodes',
      params,
      86400000 // 24 timmar cache
    );
    return response.codes || [];
  }

  // API-information - caching i 1 timme
  async getApiInfo(): Promise<ApiInfo> {
    return this.getCached<ApiInfo>('/v1/api-info', undefined, 3600000);
  }
}

// Singleton-instans
export const syllabusApi = new SyllabusApiClient();
