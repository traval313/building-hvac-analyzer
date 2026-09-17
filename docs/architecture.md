# Architecture

BuildingPulse is a React, TypeScript, and Vite single-page app for local CSV-based HVAC operations analysis.

## Runtime Model

The app runs entirely in the browser:

- no backend
- no database
- no authentication
- no external API calls
- no uploaded-file persistence

CSV files are read through the browser `File` API. Synthetic sample datasets are imported at build time as raw text and parsed through the same CSV path as uploaded files.

## Data Flow

```text
User
  -> BuildingConfigForm
  -> CsvUpload or sample data selection
  -> csvParser
  -> interval normalization
  -> hvacEnergy
  -> diagnostics
  -> severityClassification
  -> overallClassification
  -> recommendationEngine
  -> App dashboard
```

## Main Modules

| Area | Responsibility |
| --- | --- |
| `src/App.tsx` | Owns application state, triggers analysis when building config and valid CSV data are available, prepares dashboard view models, and renders main pages. |
| `src/components/BuildingConfigForm.tsx` | Collects building name, building type, electricity rate, and normal operating days. |
| `src/components/CsvUpload.tsx` | Handles CSV file selection, sample scenario loading, validation feedback, warnings, and loaded-file state. |
| `src/utils/csvParser.ts` | Parses CSV text, validates required fields, normalizes booleans and numbers, sorts rows by timestamp, removes duplicate timestamps, calculates interval durations, and reports warnings/errors. |
| `src/utils/hvacEnergy.ts` | Converts kW demand and interval hours into kWh and cost totals. |
| `src/utils/diagnostics.ts` | Calculates unoccupied energy, startup/shutdown runtime, closed-day activity, and unoccupied load ratio findings. |
| `src/utils/severityClassification.ts` | Defines low/moderate/high thresholds for each diagnostic. |
| `src/utils/overallClassification.ts` | Converts individual diagnostic severities into an overall reviewer-facing classification. |
| `src/utils/recommendationEngine.ts` | Converts diagnostic severities into prioritized recommendations. |
| `src/utils/sampleDatasets.ts` | Imports synthetic CSV fixtures and pairs them with default reviewer building configuration. |

## Analysis Inputs

Building configuration:

- `buildingName`
- `buildingType`
- `electricityRate`
- `normalOperatingDays`

CSV records:

- `timestamp`
- `occupied`
- `hvac_kw`
- optional `indoor_temp_f`
- optional `outdoor_temp_f`

After parsing, each CSV record also has:

- source row number
- timestamp milliseconds
- interval end timestamp
- interval duration in milliseconds and hours
- interval source, either `next-record` or `typical-final-record`

## Diagnostic Rules

Severity thresholds live in `src/utils/severityClassification.ts`.

| Diagnostic | Basis | Low | Moderate | High |
| --- | --- | --- | --- | --- |
| Unoccupied HVAC Energy | Unoccupied HVAC energy share | `< 5%` | `5%` through `15%` | `> 15%` |
| Startup & Shutdown | Average post-occupancy runtime | `< 1 hr` | `1 hr` through `2 hr` | `> 2 hr` |
| Closed-Day Activity | Closed-day HVAC energy share | `< 3%` | `3%` through `10%` | `> 10%` |
| Unoccupied Load Ratio | Average unoccupied demand / occupied demand | `< 20%` | `20%` through `50%` | `> 50%` |

Startup/shutdown analysis groups records by local day, finds days with occupied records, then compares significant HVAC activity against the first and last occupied intervals for that day.

Closed-day analysis derives closed days from the configured normal operating days. Any weekday not selected as normal operating is treated as closed.

## Recommendation Ordering

`recommendationEngine` creates one recommendation per diagnostic, then sorts by:

1. severity: high, moderate, low
2. diagnostic number for ties

Low-severity diagnostics still produce informational recommendations so reviewers can see that every diagnostic was considered.

## Testing Strategy

Vitest tests live beside the utility modules in `src/utils/*.test.ts`.

Current coverage focuses on deterministic business logic:

- CSV sample dataset validity
- energy and cost calculations
- occupied/unoccupied totals
- interval-duration handling
- diagnostic severity thresholds
- overall classification
- recommendation generation and ordering

UI behavior is currently covered manually through local Vite runs and sample datasets.

## Design Boundaries

- The app is intentionally static and deployable as a client-side bundle.
- CSV parsing is intentionally local and dependency-light.
- Diagnostic logic is deterministic so reviewers can reproduce results from the same inputs.
- Sample data is synthetic and kept in the repo for predictable reviews and tests.
