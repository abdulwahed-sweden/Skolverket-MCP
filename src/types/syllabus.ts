/**
 * TypeScript-typer för Skolverkets Läroplan API (Syllabus v1)
 *
 * Handskrivna, men avstämda fält för fält mot den officiella specifikationen
 * https://api.skolverket.se/syllabus/v3/api-docs (OpenAPI 3.1.0) och verifierade
 * mot live-API:et (apiVersion 1.16.2-SNAPSHOT, 2026-09-27).
 *
 * `tests/contract/type-safety.test.ts` typkontrollerar dessa mot de genererade
 * typerna i `src/types/generated/syllabus-schema.ts`. Kör `npm run typecheck:contract`
 * efter ändringar här — och lägg till nya fält som optional, annars bryts kontraktet.
 *
 * TVÅ SAKER SOM LÄTT MISSFÖRSTÅS:
 *
 * 1. Detaljendpoints svarar med en ENVELOPE, inte objektet direkt:
 *      GET /v1/subjects/{code}     -> SubjectResponse    { ..., subject: Subject }
 *      GET /v1/curriculums/{code}  -> CurriculumResponse { ..., curriculum: Curriculum }
 *      GET /v1/courses/{code}      -> CourseResponse     { ..., course: Course }
 *      GET /v1/programs/{code}     -> ProgramResponse    { ..., program: Program }
 *
 * 2. Listendpoints returnerar en KORTARE form än detaljendpoints:
 *      /v1/subjects -> SubjectInfo[]  (inget purpose, inget centralContents)
 *      /v1/courses  -> CourseInfo[]   (courseCode/courseName, inte code/name)
 *      /v1/programs -> ProgramInfo[]
 *    Versionslistorna (/versions) använder SAMMA listform, under samma nyckel
 *    (`subjects`, `courses`, ...) — det finns ingen `versions`-nyckel någonstans.
 */

// ---------------------------------------------------------------------------
// Gemensam envelope-metadata (finns på alla svar)
// ---------------------------------------------------------------------------

export interface ApiMetadata {
  apiPublisher?: string;
  apiName?: string;
  apiVersion?: string;
  apiReleased?: string;
  apiStatus?: string;
  apiDocumentation?: string;
  apiDeprecation?: string;
  apiLink?: string;
  apiSunset?: string;
  dataOrigin?: string;
  calledMethod?: string;
  totalElements?: number;
  processingTime?: string;
  startedCaching?: string;
  /** Ekar tillbaka de parametrar anropet gjordes med. */
  codeParam?: string;
  dateParam?: string;
  versionParam?: number;
  timeSpanParam?: string;
  schoolTypeParam?: string;
  typeOfSyllabusParam?: string;
}

/** Tidsperioder. API:et tar emot dem som fri sträng med LATEST som default. */
export type Timespan = 'LATEST' | 'FUTURE' | 'EXPIRED' | 'MODIFIED';

// ---------------------------------------------------------------------------
// Delade byggstenar
// ---------------------------------------------------------------------------

export interface Category {
  code?: string;
  name?: string;
}

export interface Appendix2 {
  code?: string;
  name?: string;
}

/**
 * Ett block centralt innehåll.
 *
 * `year` är ett STADIUM för grundskolan — "1-3", "4-6", "7-9" — aldrig en enskild
 * årskurs. Det finns inget `grade`-fält och ingen rubrik/innehåll-uppdelning:
 * `text` är HTML med rubriker och punktlistor inbakade.
 */
export interface CentralContent {
  text?: string;
  year?: string;
  typeOfCentralContent?: string;
}

/**
 * Ett kunskapskrav eller betygskriterium.
 *
 * `year` är det år kravet gäller vid slutet av — för grundskolan bara
 * "1", "3", "6" eller "9". `gradeStep` är betygssteget ("A"–"E") och saknas för
 * de tidigare åren, som anger godtagbara kunskaper i stället för betyg.
 * Fältet heter `gradeStep`, inte `grade`.
 */
export interface KnowledgeRequirement {
  text?: string;
  year?: string;
  gradeStep?: string;
  skolfsId?: string;
  aspectType?: string;
  aspectName?: string;
  aspectDesc?: string;
  typeOfRequirement?: string;
}

export interface Section {
  heading?: string;
  content?: string;
  type?: string;
  sortOrder?: number;
}

export interface TextBlock {
  title?: string;
  content?: string;
  type?: string;
}

/** Typ av innehåll i en studieväg. */
export type StudyPathContentType =
  | 'FOUNDATIONAL_SUBJECTS'
  | 'PROGRAMME_SPECIFIC_SUBJECTS'
  | 'ORIENTATION'
  | 'PROFILE'
  | 'PROFILE_OUTCOME'
  | 'PROFILE_OUTCOME_OPTIONAL'
  | 'PROGRAMME_SPECIALISATION'
  | 'DIPLOMA_PROJECT'
  | 'INDIVIDUAL_OPTION'
  | 'VOCATIONAL_OUTCOME'
  | 'VOCATIONAL_OUTCOME_SPECIALIZATION'
  | 'VOCATIONAL_OUTCOME_ADDITIONAL_SPECIALIZATION'
  | 'VOCATIONAL_AREA_SUBJECTS';

export interface StudyPathCourse {
  code?: string;
  name?: string;
  points?: string;
  optional?: boolean;
  note?: string;
  typeOfProgramItem?: string;
  groupId?: string;
}

export interface StudyPathSubject {
  code?: string;
  name?: string;
  points?: string;
  alias?: boolean;
  optional?: boolean;
  groupId?: string;
  note?: string;
  typeOfProgramItem?: string;
  courses?: StudyPathCourse[];
}

export interface StudyPathContent {
  type?: StudyPathContentType;
  heading?: string;
  subjects?: StudyPathSubject[];
}

// ---------------------------------------------------------------------------
// Ämnen (Subjects)
// ---------------------------------------------------------------------------

/** Kortform ur `/v1/subjects` och `/v1/subjects/{code}/versions`. */
export interface SubjectInfo {
  code?: string;
  name?: string;
  version?: number;
  typeOfSyllabus?: string;
  /** Skoltyper är en ARRAY, inte en sträng. */
  schoolTypes?: string[];
  startDate?: string;
  endDate?: string;
  createdDate?: string;
  modifiedDate?: string;
  canceledDate?: string;
  canceledSkolfs?: string;
  points?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
  categories?: Category[];
  courses?: CourseCoreInfo[];
}

/** Fullform ur `/v1/subjects/{code}` — ligger under `subject` i svaret. */
export interface Subject {
  code?: string;
  name?: string;
  englishName?: string;
  previousCode?: string;
  designation?: string;
  description?: string;
  typeOfSyllabus?: string;
  reform?: string;
  version?: number;
  versionInfo?: string;
  /** Skoltyper är en ARRAY, inte en sträng. */
  schoolTypes?: string[];
  gradeScale?: string;
  points?: string;
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
  canceledDate?: string;
  canceledSkolfs?: string;
  validTo?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
  /** Syftet är EN HTML-sträng, inte en lista. */
  purpose?: string;
  educationalObjectives?: string;
  educationalStructure?: string;
  readAndWriteLearning?: string;
  assessment?: string;
  categories?: Category[];
  courses?: Course[];
  appendix2List?: Appendix2[];
  centralContents?: CentralContent[];
  knowledgeRequirements?: KnowledgeRequirement[];
  /** Färdiga HTML-rubriker som hör till respektive avsnitt. */
  codeHeading?: string;
  nameHeading?: string;
  pointsHeading?: string;
  pointHeading?: string;
  purposeHeading?: string;
  coursesHeading?: string;
  centralCntHeading?: string;
  knowledgeReqsHeading?: string;
}

/** `GET /v1/subjects` och `GET /v1/subjects/{code}/versions`. */
export interface SubjectsResponse extends ApiMetadata {
  subjects?: SubjectInfo[];
}

/** `GET /v1/subjects/{code}` och `.../versions/{version}`. */
export interface SubjectResponse extends ApiMetadata {
  subject?: Subject;
}

// ---------------------------------------------------------------------------
// Kurser (Courses)
// ---------------------------------------------------------------------------

/** Ämnet en kurs hör till, i fullformen. */
export interface SubjectParent {
  subjectCode?: string;
  subjectName?: string;
  previousSubjectCode?: string;
  subjectPurpose?: string;
  version?: number;
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
  schoolTypes?: string[];
  categories?: Category[];
}

/** Ämnet en kurs hör till, i kortformen. */
export interface SubjectInfoParent {
  subjectCode?: string;
  subjectName?: string;
  version?: number;
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
  schoolTypes?: string[];
  categories?: Category[];
}

/** Kurs som ingår i ett ämnes `courses`-lista. */
export interface CourseCoreInfo {
  code?: string;
  name?: string;
  point?: string;
  points?: string;
  sortOrder?: number;
}

/**
 * Kortform ur `/v1/courses` och `/v1/courses/{code}/versions`.
 * OBS: fälten heter `courseCode`/`courseName`/`coursePoints` — inte `code`/`name`.
 * Skoltyp och ämneskod finns bara via `subjectParent`.
 */
export interface CourseInfo {
  courseCode?: string;
  courseName?: string;
  coursePoints?: string;
  version?: number;
  categories?: Category[];
  subjectParent?: SubjectInfoParent;
}

/**
 * Fullform ur `/v1/courses/{code}` — ligger under `course` i svaret.
 * OBS: `centralContent` är ETT objekt här, till skillnad från ämnets
 * `centralContents`-array.
 */
export interface Course {
  code?: string;
  name?: string;
  englishName?: string;
  previousCode?: string;
  description?: string;
  typeOfSyllabus?: string;
  points?: string;
  sortOrder?: number;
  versionInfo?: string;
  gers?: string;
  studyPathDescription?: string;
  subjectParent?: SubjectParent;
  centralContent?: CentralContent;
  knowledgeRequirements?: KnowledgeRequirement[];
  codeHeading?: string;
  nameHeading?: string;
  pointsHeading?: string;
  pointHeading?: string;
  centralCntHeading?: string;
  knowledgeReqsHeading?: string;
}

/** `GET /v1/courses` och `GET /v1/courses/{code}/versions`. */
export interface CoursesResponse extends ApiMetadata {
  courses?: CourseInfo[];
}

/** `GET /v1/courses/{code}` och `.../versions/{version}`. */
export interface CourseResponse extends ApiMetadata {
  course?: Course;
}

// ---------------------------------------------------------------------------
// Program (Programs)
// ---------------------------------------------------------------------------

export interface OrientationInfo {
  code?: string;
  name?: string;
  englishName?: string;
  points?: string;
}

export interface ProfileInfo {
  code?: string;
  name?: string;
  englishName?: string;
  points?: string;
}

export interface Orientation extends StudyPathContent {
  code?: string;
  name?: string;
  englishName?: string;
  points?: string;
  programCode?: string;
  primarySchoolType?: string;
}

export interface ProfileOutcomeOptional extends StudyPathContent {
  points?: string;
}

export interface ProfileOutcome extends StudyPathContent {
  name?: string;
  englishName?: string;
  points?: string;
  optionalCourses?: ProfileOutcomeOptional;
}

export interface Profile extends StudyPathContent {
  code?: string;
  name?: string;
  englishName?: string;
  points?: string;
  programCode?: string;
  primarySchoolType?: string;
  profileOutcomes?: ProfileOutcome[];
}

export interface VocationalOutcome extends StudyPathContent {
  name?: string;
  englishName?: string;
  text?: string;
  orientationCode?: string;
  specialization?: StudyPathContent;
  additionalSpecialization?: StudyPathContent;
}

export interface DegreeObjectives {
  studyPathCode?: string;
  name?: string;
  englishName?: string;
  heading?: string;
  version?: number;
  versionInfo?: string;
  studyPathType?: string;
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
  textBlocks?: TextBlock[];
}

/** Kortform ur `/v1/programs` och `/v1/programs/{code}/versions`. */
export interface ProgramInfo {
  code?: string;
  name?: string;
  englishName?: string;
  version?: number;
  category?: string;
  studyPathType?: string;
  /** Skoltyper är en ARRAY, inte en sträng. */
  schoolTypes?: string[];
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
  canceledDate?: string;
  canceledSkolfs?: string;
  orientations?: OrientationInfo[];
  profiles?: ProfileInfo[];
}

/** Fullform ur `/v1/programs/{code}` — ligger under `program` i svaret. */
export interface Program {
  code?: string;
  name?: string;
  englishName?: string;
  version?: number;
  versionInfo?: string;
  category?: string;
  studyPathType?: string;
  schoolTypes?: string[];
  startDate?: string;
  endDate?: string;
  createdDate?: string;
  modifiedDate?: string;
  canceledDate?: string;
  canceledSkolfs?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
  legalText?: string;
  degreeObjectives?: DegreeObjectives;
  foundationSubjects?: StudyPathContent;
  programmeSpecificSubjects?: StudyPathContent;
  specialization?: StudyPathContent;
  diplomaProject?: StudyPathContent;
  individualOption?: StudyPathContent;
  orientations?: Orientation[];
  profiles?: Profile[];
  vocationalOutcomes?: VocationalOutcome[];
}

/** `GET /v1/programs` och `GET /v1/programs/{code}/versions`. */
export interface ProgramsResponse extends ApiMetadata {
  programs?: ProgramInfo[];
  typeOfStudyPathParam?: string;
}

/** `GET /v1/programs/{code}` och `.../versions/{version}`. */
export interface ProgramResponse extends ApiMetadata {
  program?: Program;
}

// ---------------------------------------------------------------------------
// Läroplaner (Curriculums)
// ---------------------------------------------------------------------------

/** Kortform ur `/v1/curriculums` och `/v1/curriculums/{code}/versions`. */
export interface CurriculumInfo {
  code?: string;
  name?: string;
  englishName?: string;
  version?: number;
  versionInfo?: string;
  /** Skoltyper är en ARRAY, inte en sträng. */
  schoolTypes?: string[];
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
  skolfsGrund?: string;
  skolfsAndring?: string;
}

/**
 * Fullform ur `/v1/curriculums/{code}` — ligger under `curriculum` i svaret.
 * Läroplanen har inget `typeOfSyllabus` och ingen `description`.
 */
export interface Curriculum extends CurriculumInfo {
  heading?: string;
  sections?: Section[];
}

/** `GET /v1/curriculums` och `GET /v1/curriculums/{code}/versions`. */
export interface CurriculumsResponse extends ApiMetadata {
  curriculums?: CurriculumInfo[];
}

/** `GET /v1/curriculums/{code}` och `.../versions/{version}`. */
export interface CurriculumResponse extends ApiMetadata {
  curriculum?: Curriculum;
}

// ---------------------------------------------------------------------------
// Värdesamlingar (Value Store)
// ---------------------------------------------------------------------------

/** Ur `/v1/valuestore/schooltypes`. Har min/maxGrade — men ingen `description`. */
export interface SchoolType {
  code?: string;
  name?: string;
  /** Lägsta respektive högsta årskurs i skolformen. */
  minGrade?: number;
  maxGrade?: number;
  /** Läroplanskoden skolformen hänvisar till. Kan vara utgången. */
  curriculumCode?: string;
  jointSchoolType?: string;
  displaySortOrder?: number;
  startDate?: string;
  endDate?: string;
}

/** Ur `/v1/valuestore/typeofsyllabus`. Har `description`, men inget `name`. */
export interface TypeOfSyllabus {
  code?: string;
  description?: string;
}

/** Ur `/v1/valuestore/subjectandcoursecodes`. Skiljer ämne/kurs via `typeOfSyllabus`. */
export interface SubjectAndCourseCode {
  code?: string;
  name?: string;
  typeOfSyllabus?: string;
  endDate?: string;
}

/** Ur `/v1/valuestore/studypathcodes`. */
export interface StudyPathCode {
  code?: string;
  name?: string;
  englishName?: string;
  type?: string;
  version?: string;
  programCode?: string;
  programName?: string;
  programType?: string;
  schoolTypes?: string[];
  startDate?: string;
  endDate?: string;
  modifiedDate?: string;
}

export interface SchoolTypesResponse extends ApiMetadata {
  schoolTypes?: SchoolType[];
}

/** OBS: nyckeln är `typeOfSyllabusList`, inte `typesOfSyllabus`. */
export interface TypeOfSyllabusResponse extends ApiMetadata {
  typeOfSyllabusList?: TypeOfSyllabus[];
}

export interface SubjectAndCourseCodesResponse extends ApiMetadata {
  codes?: SubjectAndCourseCode[];
}

/** OBS: nyckeln är `codes`, inte `studyPaths`. */
export interface StudyPathCodesResponse extends ApiMetadata {
  codes?: StudyPathCode[];
}

// ---------------------------------------------------------------------------
// API-information
// ---------------------------------------------------------------------------

/** `GET /v1/api-info` returnerar bara envelope-metadata. */
export interface ApiInfo extends ApiMetadata {}

// ---------------------------------------------------------------------------
// Sökparametrar
// ---------------------------------------------------------------------------

export interface SearchParams {
  schooltype?: string;
  timespan?: Timespan;
  /** YYYY-MM-DD */
  date?: string;
}

export interface SubjectSearchParams extends SearchParams {
  typeOfSyllabus?: string;
}

/** `/v1/courses` filtrerar inte på ämneskod — API:et tar inte emot subjectCode. */
export interface CourseSearchParams extends SearchParams {}

export interface ProgramSearchParams extends SearchParams {
  typeOfStudyPath?: string;
}

export interface CurriculumSearchParams extends SearchParams {}

export interface StudyPathSearchParams extends SearchParams {
  typeOfStudyPath?: string;
  typeOfProgram?: string;
}
