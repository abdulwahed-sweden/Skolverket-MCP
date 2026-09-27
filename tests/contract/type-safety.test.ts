/**
 * Kontrakttest: håller de handskrivna typerna i `src/types/` i linje med
 * Skolverkets egna OpenAPI-definitioner i `src/types/generated/`.
 *
 * BAKGRUND: den tidigare versionen av denna fil importerade genererade typer som
 * aldrig hade genererats. Importen blev `any`, `expectTypeOf` är en no-op vid
 * körning, och vitest typkontrollerar inte som standard — alltså gick alla
 * påståenden igenom utan att kontrollera något. Under tiden drev de handskrivna
 * Syllabus-typerna iväg från API:et (`schoolType` i stället för `schoolTypes`,
 * ett påhittat `grade`, `purposes` som lista, saknad envelope).
 *
 * DÄRFÖR tvingas kontraktet nu igenom på två oberoende sätt:
 *
 *  1. Kompileringstid — `type Expect<...>`-raderna nedan är äkta typfel om
 *     kontraktet bryts. De kontrolleras av `npm run typecheck` (som inkluderar
 *     tests/ via tsconfig.test.json), INTE av `npm test` ensamt.
 *
 *  2. Körningstid — testerna längst ner läser båda filerna som text och jämför
 *     fältnamnen. De fallerar även om någon kör `vitest` utan typkontroll.
 *
 * Regenerera specifikationerna med `npm run sync:api-types`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SchoolUnit } from '../../src/types/school-units.js';
import type { PlannedSchoolUnit } from '../../src/types/planned-education.js';
import type {
  Subject,
  SubjectInfo,
  CentralContent,
  KnowledgeRequirement,
  Curriculum,
  CurriculumInfo,
  Section,
  Course,
  CourseInfo,
  SchoolType,
  TypeOfSyllabus,
  SubjectAndCourseCode,
  StudyPathCode,
} from '../../src/types/syllabus.js';

import type { components as SchoolUnitComponents } from '../../src/types/generated/school-units-schema.js';
import type { components as SyllabusComponents } from '../../src/types/generated/syllabus-schema.js';
import type { components as PlannedEduComponents } from '../../src/types/generated/planned-education-schema.js';

type SyllabusSchemas = SyllabusComponents['schemas'];

// ---------------------------------------------------------------------------
// Kompileringstidskontrakt
// ---------------------------------------------------------------------------

/** Ger typfel om `T` inte är exakt `true`. */
type Expect<T extends true> = T;

type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Fält vi påstår finns, men som specifikationen inte känner till.
 * Det här är kontrollen som fångar påhittade fält — den som saknades när
 * `CentralContent.grade` och `Subject.purposes` kunde leva vidare.
 */
type InventedFields<Mine, Generated> = Exclude<keyof Mine, keyof Generated>;

type NoInventedFields<Mine, Generated> = IsNever<InventedFields<Mine, Generated>>;

/**
 * Varje svar från API:et ska gå att läsa genom vår typ. Fångar fel typ på
 * delade fält, t.ex. `string` där specifikationen säger `string[]`.
 */
type ReadableAsMine<Generated, Mine> = Generated extends Mine ? true : false;

/* eslint-disable @typescript-eslint/no-unused-vars */

// Inga påhittade fält någonstans i Syllabus-typerna.
type _Subject = Expect<NoInventedFields<Subject, SyllabusSchemas['Subject']>>;
type _SubjectInfo = Expect<NoInventedFields<SubjectInfo, SyllabusSchemas['SubjectInfo']>>;
type _CentralContent = Expect<
  NoInventedFields<CentralContent, SyllabusSchemas['CentralContent']>
>;
type _KnowledgeRequirement = Expect<
  NoInventedFields<KnowledgeRequirement, SyllabusSchemas['KnowledgeRequirement']>
>;
type _Curriculum = Expect<NoInventedFields<Curriculum, SyllabusSchemas['Curriculum']>>;
type _CurriculumInfo = Expect<
  NoInventedFields<CurriculumInfo, SyllabusSchemas['CurriculumInfo']>
>;
type _Section = Expect<NoInventedFields<Section, SyllabusSchemas['Section']>>;
type _Course = Expect<NoInventedFields<Course, SyllabusSchemas['Course']>>;
type _CourseInfo = Expect<NoInventedFields<CourseInfo, SyllabusSchemas['CourseInfo']>>;
type _SchoolType = Expect<NoInventedFields<SchoolType, SyllabusSchemas['SchoolTypeInfo']>>;
type _TypeOfSyllabus = Expect<
  NoInventedFields<TypeOfSyllabus, SyllabusSchemas['TypeOfSyllabus']>
>;
type _SubjectAndCourseCode = Expect<
  NoInventedFields<SubjectAndCourseCode, SyllabusSchemas['SubjectAndCourseCodeInfo']>
>;
type _StudyPathCode = Expect<
  NoInventedFields<StudyPathCode, SyllabusSchemas['StudyPathCodeInfo']>
>;

// Delade fält måste ha kompatibel typ.
type _SubjectReadable = Expect<ReadableAsMine<SyllabusSchemas['Subject'], Subject>>;
type _SubjectInfoReadable = Expect<ReadableAsMine<SyllabusSchemas['SubjectInfo'], SubjectInfo>>;
type _CentralContentReadable = Expect<
  ReadableAsMine<SyllabusSchemas['CentralContent'], CentralContent>
>;
type _KnowledgeRequirementReadable = Expect<
  ReadableAsMine<SyllabusSchemas['KnowledgeRequirement'], KnowledgeRequirement>
>;
type _CurriculumInfoReadable = Expect<
  ReadableAsMine<SyllabusSchemas['CurriculumInfo'], CurriculumInfo>
>;
type _SectionReadable = Expect<ReadableAsMine<SyllabusSchemas['Section'], Section>>;
type _CourseInfoReadable = Expect<ReadableAsMine<SyllabusSchemas['CourseInfo'], CourseInfo>>;
type _SchoolTypeReadable = Expect<
  ReadableAsMine<SyllabusSchemas['SchoolTypeInfo'], SchoolType>
>;

// De två andra API:erna täcks bara grundligt nog för att fånga att de
// genererade typerna finns och kan läsas. Skolenhetsregistret och Planned
// Educations har INTE gåtts igenom fält för fält som Syllabus — gör det innan
// någon förlitar sig på deras handskrivna typer.
// Den gamla versionen av denna fil importerade en typ `PlannedEducation` som
// aldrig har funnits; det gick obemärkt förbi eftersom filen inte typkontrollerades.
type _SchoolUnit = Expect<
  ReadableAsMine<SchoolUnitComponents['schemas']['SchoolUnit'], Partial<SchoolUnit>>
>;
type _PlannedEducation = Expect<
  PlannedEduComponents['schemas'] extends Record<string, unknown> ? true : false
>;
type _PlannedSchoolUnitUsed = PlannedSchoolUnit;

/* eslint-enable @typescript-eslint/no-unused-vars */

// ---------------------------------------------------------------------------
// Körningstidskontrakt
//
// Läser BÅDA filerna som text och jämför fältnamnen. Ingen handunderhållen
// spegling av typerna — annars slutar testet följa dem, vilket är precis så den
// förra versionen förföll. Fångar därmed samma fel som typkontrollen, även om
// någon kör `vitest` utan `npm run typecheck`.
// ---------------------------------------------------------------------------

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const handwritten = readFileSync(join(root, 'src/types/syllabus.ts'), 'utf8');
const generated = readFileSync(join(root, 'src/types/generated/syllabus-schema.ts'), 'utf8');

/** Plockar ut fältnamnen i en interface-deklaration ur den handskrivna filen. */
function handwrittenFields(name: string): string[] {
  const re = new RegExp(`export interface ${name}(?: extends [^{]+)?\\s*\\{`);
  const m = handwritten.match(re);
  expect(m, `interface ${name} saknas i src/types/syllabus.ts`).not.toBeNull();
  const start = m!.index! + m![0].length;
  const end = handwritten.indexOf('\n}', start);
  const body = handwritten.slice(start, end);
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((x) => x[1]);
}

/** Klipper ut en schemadefinition ur den genererade filen. */
function generatedSchemaBody(schema: string): string {
  const start = generated.indexOf(`        ${schema}: {`);
  expect(start, `schemat ${schema} saknas i den genererade filen`).toBeGreaterThan(-1);
  const end = generated.indexOf('\n        };', start);
  return generated.slice(start, end);
}

function generatedFields(schema: string): string[] {
  const body = generatedSchemaBody(schema);
  return [...body.matchAll(/^\s{12}(\w+)\??:/gm)].map((x) => x[1]);
}

/**
 * Handskriven typ -> schemanamn i specifikationen. Typer som medvetet inte
 * motsvarar ett schema (envelope-alias, sökparametrar) står inte här.
 */
const TYPE_TO_SCHEMA: Record<string, string> = {
  Subject: 'Subject',
  SubjectInfo: 'SubjectInfo',
  CentralContent: 'CentralContent',
  KnowledgeRequirement: 'KnowledgeRequirement',
  Curriculum: 'Curriculum',
  CurriculumInfo: 'CurriculumInfo',
  Section: 'Section',
  TextBlock: 'TextBlock',
  Course: 'Course',
  CourseInfo: 'CourseInfo',
  CourseCoreInfo: 'CourseCoreInfo',
  Program: 'Program',
  ProgramInfo: 'ProgramInfo',
  Category: 'Category',
  Appendix2: 'Appendix2',
  SubjectParent: 'SubjectParent',
  SubjectInfoParent: 'SubjectInfoParent',
  StudyPathCourse: 'StudyPathCourse',
  StudyPathSubject: 'StudyPathSubject',
  StudyPathContent: 'StudyPathContent',
  DegreeObjectives: 'DegreeObjectives',
  OrientationInfo: 'OrientationInfo',
  ProfileInfo: 'ProfileInfo',
  SchoolType: 'SchoolTypeInfo',
  TypeOfSyllabus: 'TypeOfSyllabus',
  SubjectAndCourseCode: 'SubjectAndCourseCodeInfo',
  StudyPathCode: 'StudyPathCodeInfo',
};

describe('Syllabus: inga påhittade fält', () => {
  for (const [typeName, schema] of Object.entries(TYPE_TO_SCHEMA)) {
    it(`${typeName} deklarerar bara fält som finns i ${schema}`, () => {
      const invented = handwrittenFields(typeName).filter(
        (f) => !generatedFields(schema).includes(f)
      );
      expect(invented, `fält som inte finns i specifikationens ${schema}`).toEqual([]);
    });
  }

  it('kontrollen fångar faktiskt ett påhittat fält', () => {
    // Bevisar att testet ovan kan fallera: `grade` och `heading` är de fält den
    // gamla CentralContent-typen påstod fanns.
    const fields = generatedFields('CentralContent');
    expect(fields).toContain('year');
    expect(fields).not.toContain('grade');
    expect(fields).not.toContain('heading');
    expect(handwrittenFields('CentralContent')).not.toContain('grade');
  });
});

describe('Syllabus: former som är lätta att missförstå', () => {
  it('Subject har schoolTypes som array, inte schoolType som sträng', () => {
    expect(generatedSchemaBody('Subject')).toMatch(/schoolTypes\??:\s*string\[\]/);
    expect(generatedFields('Subject')).not.toContain('schoolType');
    expect(handwrittenFields('Subject')).toContain('schoolTypes');
    expect(handwrittenFields('Subject')).not.toContain('schoolType');
  });

  it('Subject har purpose som sträng, inte purposes som lista', () => {
    expect(generatedSchemaBody('Subject')).toMatch(/purpose\??:\s*string/);
    expect(generatedFields('Subject')).not.toContain('purposes');
    expect(handwrittenFields('Subject')).not.toContain('purposes');
  });

  it('Subject har centralContents i plural', () => {
    expect(generatedFields('Subject')).toContain('centralContents');
    expect(generatedFields('Subject')).not.toContain('centralContent');
    expect(handwrittenFields('Subject')).toContain('centralContents');
  });

  it('KnowledgeRequirement har gradeStep, inte grade', () => {
    expect(generatedFields('KnowledgeRequirement')).toContain('gradeStep');
    expect(generatedFields('KnowledgeRequirement')).not.toContain('grade');
    expect(handwrittenFields('KnowledgeRequirement')).not.toContain('grade');
  });

  it('Course har centralContent i singular — till skillnad från Subject', () => {
    expect(generatedFields('Course')).toContain('centralContent');
    expect(generatedFields('Course')).not.toContain('centralContents');
  });

  it('detaljsvaren är envelopes med objektet under en egen nyckel', () => {
    expect(generatedSchemaBody('SubjectResponse')).toMatch(
      /subject\??:\s*components\["schemas"\]\["Subject"\]/
    );
    expect(generatedSchemaBody('CurriculumResponse')).toMatch(
      /curriculum\??:\s*components\["schemas"\]\["Curriculum"\]/
    );
    expect(handwrittenFields('SubjectResponse')).toEqual(['subject']);
    expect(handwrittenFields('CurriculumResponse')).toEqual(['curriculum']);
  });

  it('versionslistorna använder listnyckeln, inte en versions-nyckel', () => {
    expect(generatedFields('SubjectsResponse')).toContain('subjects');
    expect(generatedFields('SubjectsResponse')).not.toContain('versions');
    expect(handwrittenFields('SubjectsResponse')).toEqual(['subjects']);
  });

  it('värdesamlingarna använder typeOfSyllabusList respektive codes', () => {
    expect(generatedFields('TypeOfSyllabusResponse')).toContain('typeOfSyllabusList');
    expect(generatedFields('StudyPathCodesResponse')).toContain('codes');
    expect(generatedFields('StudyPathCodesResponse')).not.toContain('studyPaths');
    expect(handwrittenFields('TypeOfSyllabusResponse')).toEqual(['typeOfSyllabusList']);
    expect(handwrittenFields('StudyPathCodesResponse')).toEqual(['codes']);
  });
});
