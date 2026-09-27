# API-dokumentation

## Alla Verktyg (89 st enligt `tools/list`)

### Läroplan API (17 verktyg)

#### Ämnen
- `search_subjects` - Sök ämnen med filter
- `get_subject_details` - Hämta fullständig ämnesinformation
- `get_subject_versions` - Se historiska versioner

#### Kurser
- `search_courses` - Sök kurser med omfattande filter
- `get_course_details` - Detaljerad kursinformation med kunskapskrav
- `get_course_versions` - Historiska kursversioner

#### Program
- `search_programs` - Sök gymnasieprogram
- `get_program_details` - Programinformation med inriktningar
- `get_program_versions` - Programversioner över tid

#### Läroplaner
- `search_curriculums` - Sök läroplaner (LGR22 för grundskolan, etc.)
- `get_curriculum_details` - Fullständig läroplan
- `get_curriculum_versions` - Läroplansversioner

#### Stöddata
- `get_school_types` - Lista skoltyper
- `get_types_of_syllabus` - Lista läroplanstyper
- `get_subject_and_course_codes` - Alla ämnes- och kurskoder
- `get_study_path_codes` - Studievägskodar
- `get_api_info` - API-information

### Handledarverktyg (2 verktyg)

Bygger på Läroplan API ovan och inför ingen ny datakälla. Avsedda för att grunda
en AI-handledare i officiell läroplan i stället för påhittat innehåll.

- `get_tutor_stage_curriculum` - Läroplan för ett ämne och ett stadium,
  normaliserad, med `provenance` som anger vilket API-fält varje värde kommer ur.
  Kräver `subject` eller `subjectCode` — ämnet har inget default
- `get_tutor_teaching_context` - Samma data uppdelad i undervisningsbara enheter
  med stabila id:n, plus en grundande brief där all läroplanstext är ordagrann

#### MCP-prompt: `tutor_student_session`

Hela handledargränssnittet är en MCP-prompt, inte en applikation. Klienten hämtar
prompten, prompten säger åt klienten att anropa `get_tutor_teaching_context`, och
undervisningen sker i klienten. Inget elevtillstånd lagras här.

**Obligatoriska argument:** `student_name`, `grade`, `subject`. Det finns inga
defaultvärden för elevuppgifter — Skolverket-MCP kan läroplan, men känner inte
barnet. Ett underförstått ämne skulle ge giltig men fel läroplan och därmed ändra
vad eleven undervisas i, så ämnet gissas aldrig: saknas det, eller är det okänt,
avvisas anropet.

Accepterade ämnesvärden (skiftlägesokänsligt): `svenska`, `sv`, `GRGRSVE01`
→ **GRGRSVE01**; `svenska som andraspråk`, `svenska som andrasprak`,
`svenska_som_andrasprak`, `sva`, `GRGRSVA01` → **GRGRSVA01**.

**Valfria argument:** `unit_id`, `fallback_language`. `fallback_language` har
inget default — anges inget reservspråk hålls hela passet på svenska i stället
för att ett språk antas åt eleven.

Stadiet härleds ur årskursen enligt Skolverkets egen indelning: årskurs 1-3 →
`"1-3"`, 4-6 → `"4-6"`, 7-9 → `"7-9"`.

**Viktigt om årskurser.** Skolverket publicerar centralt innehåll per *stadium*
(`"1-3"`, `"4-6"`, `"7-9"`), aldrig per årskurs, och betygskriterier bara för
slutet av årskurs 1, 3, 6 och 9. Det finns alltså inget läroplansinnehåll som är
specifikt för exempelvis årskurs 5. Verktygen svarar därför alltid med
`stage.gradeIsExplicitInApi: false` och
`relevantAssessmentCriteria.noneForRequestedGrade`, och de vägrar hitta på
kopplingar mellan betygskriterier och enskilda punkter i det centrala innehållet
— Skolverket publicerar ingen sådan koppling.

```
get_tutor_teaching_context { subject: "svenska som andraspråk", grade: 5, stage: "4-6" }
  -> subjectCode: GRGRSVA01
     units: GRGRSVA01/4-6/lasa-och-skriva (8 punkter), .../texter (5), ...
     counts: 5 enheter / 27 punkter / 5 kriterier
     stageAssessment: årskurs 6, betygssteg E-A
     groundedBrief: officiell text ordagrant, med härkomst och regler

get_tutor_teaching_context { subject: "svenska", grade: 5, stage: "4-6" }
  -> subjectCode: GRGRSVE01, 5 enheter / 21 punkter   (annat ämne, annat innehåll)
```

### Skolenhetsregistret API (4 verktyg)

- `search_school_units` - Sök skolenheter med filter
- `get_school_unit_details` - Hämta skolenhetsdetaljer
- `get_school_units_by_status` - Filtrera efter status
- `search_school_units_by_name` - Sök efter namn

### Planned Educations API (7 verktyg)

#### Vuxenutbildning
- `search_adult_education` - Sök vuxenutbildningar (YH, SFI, Komvux)
- `get_adult_education_details` - Detaljerad utbildningsinformation
- `filter_adult_education_by_distance` - Filtrera distans/campus
- `filter_adult_education_by_pace` - Filtrera efter studietakt

#### Stöddata
- `get_education_areas` - Hämta utbildningsområden
- `get_directions` - Hämta inriktningar

### Diagnostik (1 verktyg)

- `health_check` - Testa API-anslutningar och systemstatus

## Vanliga Koder och Termer

### Skoltyper
- `GR` - Grundskolan
- `GY` - Gymnasieskolan
- `VUX` - Vuxenutbildning
- `GRSÄR` - Grundsärskolan
- `GYSÄR` - Gymnasiesärskolan

### Utbildningsformer (typeOfSchool)
- `yh` - Yrkeshögskola
- `sfi` - SFI (Svenska för invandrare)
- `komvuxgycourses` - Komvux gymnasiekurser
- `komvuxbasiccourses` - Komvux grundläggande kurser

### Exempel på Koder
- **Kurser**: `MATMAT01c` (Matematik 1c), `SVESVE01` (Svenska 1)
- **Ämnen**: `GRGRMAT01` (Matematik grundskola)
- **Program**: `NA` (Naturvetenskap), `TE` (Teknik), `EK` (Ekonomi)
- **Läroplaner**: `LGR11` (Läroplan för grundskolan 2011), `GY11` (Gymnasiet 2011)

## API-endpoints

Servern använder följande Skolverket API:er:
- **Läroplan API**: `https://api.skolverket.se/syllabus`
- **Skolenhetsregistret**: `https://api.skolverket.se/skolenhetsregistret/v2`
- **Planned Educations**: `https://api.skolverket.se/planned-educations` (v4)
