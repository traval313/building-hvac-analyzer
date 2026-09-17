# BuildingPulse HVAC Operations Analyzer

BuildingPulse is a lightweight browser-based decision-support tool for reviewing commercial building HVAC operation from time-series CSV data.

The app helps developers and reviewers identify common operational inefficiencies:

- unoccupied HVAC energy use
- extended startup or shutdown periods
- HVAC activity on configured closed days
- high unoccupied HVAC demand compared with occupied demand

All analysis runs locally in the browser. The project has no backend, database, authentication layer, or external data service.

## Project Context

Developed as part of the IBM SkillsBuild Micro-Internship for Trane Technologies.

## Product Overview

The MVP workflow is:

```text
Configure building -> Upload CSV or load sample data -> Validate data -> Analyze -> Review findings -> Review recommendations
```

Users provide a building setup with:

- building name
- building type
- electricity rate in dollars per kWh
- normal operating days

Users then upload a local CSV or choose one of the built-in synthetic sample datasets. BuildingPulse validates the file, normalizes intervals, calculates HVAC energy and cost, classifies diagnostic severity, and displays prioritized recommendations.

## Setup

Prerequisites:

- Node.js 20 or newer is recommended for Vite 7
- npm

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173/`.

## Run Commands

```bash
npm run dev
```

Starts the Vite development server.

```bash
npm run build
```

Runs TypeScript project build checks and creates a production build in `dist/`.

```bash
npm run preview
```

Serves the production build locally after `npm run build`.

```bash
npm test
```

Runs the Vitest unit test suite once.

```bash
npx vitest
```

Runs Vitest in watch mode for local test development.

## CSV Schema

Uploaded CSV files must include these required headers:

| Column | Required | Type | Notes |
| --- | --- | --- | --- |
| `timestamp` | Yes | Date/time | Local timestamps like `2026-09-07 08:00`, `2026-09-07T08:00`, or other values accepted by `Date.parse`. |
| `occupied` | Yes | Boolean | Accepted true values: `true`, `t`, `yes`, `y`, `1`, `occupied`. Accepted false values: `false`, `f`, `no`, `n`, `0`, `unoccupied`. |
| `hvac_kw` | Yes | Number | HVAC demand in kW. Must be zero or greater. |
| `indoor_temp_f` | No | Number | Optional indoor temperature in Fahrenheit. Parsed and preserved for future use. |
| `outdoor_temp_f` | No | Number | Optional outdoor temperature in Fahrenheit. Parsed and preserved for future use. |

Example:

```csv
timestamp,occupied,hvac_kw,indoor_temp_f,outdoor_temp_f
2026-09-07 07:00,false,14.2,72.1,63.4
2026-09-07 08:00,true,48.7,72.0,64.0
```

CSV validation behavior:

- Header names are trimmed, lowercased, and support a UTF-8 BOM on the first header.
- Duplicate timestamp rows are ignored after sorting; a warning identifies the source rows.
- Records are sorted by timestamp before analysis.
- The app calculates each interval from the next timestamp. The final record uses the median observed interval.
- Irregular intervals more than 10% away from the median interval are allowed with a warning.
- Files must contain at least two valid data rows and cover at least 24 hours.

## Architecture Summary

BuildingPulse is a React, TypeScript, and Vite single-page app.

```text
React UI
  -> building configuration form
  -> CSV upload or sample dataset loader
  -> CSV parser and validator
  -> interval normalization
  -> HVAC energy summary
  -> diagnostic calculations
  -> severity classification
  -> recommendation sorting
  -> dashboard charts and findings
```

Important source areas:

- `src/App.tsx` coordinates state, parsing, analysis, overall classification, and page rendering.
- `src/components/` contains the building setup form, CSV upload workflow, and chart components.
- `src/utils/csvParser.ts` parses, validates, sorts, de-duplicates, and normalizes CSV records.
- `src/utils/hvacEnergy.ts` calculates interval energy and electricity cost totals.
- `src/utils/diagnostics.ts` calculates the four diagnostic findings.
- `src/utils/severityClassification.ts` stores diagnostic thresholds.
- `src/utils/recommendationEngine.ts` maps diagnostic severities to reviewer recommendations.
- `sample-data/` contains synthetic CSV fixtures used by reviewers and tests.

See [docs/architecture.md](docs/architecture.md) for more detail.

## Sample Data

Synthetic sample datasets are available in [sample-data/](sample-data/). They contain no real customer, facility, Trane, or personal data.

Reviewer scenarios:

- `efficient-building.csv`: low-concern baseline with HVAC operation mostly aligned to weekday occupancy.
- `after-hours-issue.csv`: elevated HVAC operation before and after occupied hours.
- `weekend-issue.csv`: elevated HVAC operation on configured closed days.

The app also imports these three files into the UI as one-click sample scenarios. Expected diagnostic results and assumptions are documented in [sample-data/README.md](sample-data/README.md).

## Testing

Run all automated tests:

```bash
npm test
```

The current tests cover:

- CSV sample data validity
- HVAC energy and cost calculations
- interval-duration handling
- occupied and unoccupied energy totals
- diagnostic severity classification
- overall review classification
- recommendation ordering and text selection

Build verification:

```bash
npm run build
```

## Known Limitations

- Analysis is client-side only and intended for CSV-based review workflows.
- Uploaded data is not persisted after page refresh.
- There is no user account system, project history, backend storage, or export workflow.
- Diagnostic thresholds are static rule-based heuristics, not calibrated models.
- Occupancy is read directly from the CSV; the app does not infer occupancy from sensors or schedules.
- Electricity cost uses one flat electricity rate and does not model demand charges, time-of-use rates, taxes, or tariffs.
- Temperature columns are parsed but not currently used in diagnostic logic.
- Timestamp handling is based on local browser date parsing for local timestamp formats.
- Sample datasets are synthetic and should not be treated as real building performance benchmarks.

## Documentation

- [Product requirements](docs/PRD.md)
- [Architecture](docs/architecture.md)
- [Sample data guide](sample-data/README.md)

## Status

MVP development in progress.
