# GRGRSVA01 — Svenska som andraspråk — Years 4–6

Structured reference export for the official Skolverket curriculum content used by the tutor.

## Important

- Source subject: `GRGRSVA01` — Svenska som andraspråk
- Curriculum: `LGR22`
- Official stage: years `4–6`
- The source does **not** define Grade-5-specific central content.
- Grade 5 is the requested student grade; the official central content applies to the whole 4–6 stage.
- Year-6 assessment criteria are stored separately and must not be presented as a current Grade-5 judgment.
- These files are reference exports. Runtime code should continue to use the live MCP/API path as the source of truth.

## Layout

- `teaching-context.json` — complete normalized teaching-context export.
- `index.json` — compact manifest of units and counts.
- `units/` — one file per official central-content heading:
  - `01-lasa-och-skriva.json` — Läsa och skriva (8 points)
  - `02-tala-lyssna-och-samtala.json` — Tala, lyssna och samtala (6 points)
  - `03-texter.json` — Texter (6 points)
  - `04-sprakbruk.json` — Språkbruk (5 points)
  - `05-informationssokning-och-kallkritik.json` — Informationssökning och källkritik (2 points)
- `assessment/year-6.json` — official end-of-Year-6 criteria returned with the stage context.

## Use

A future tutor may select one unit at a time and create its own exercises, examples, and pacing.
Tutor-created material must not be represented as official Skolverket text.
