# HVAC Operations Analyzer

BuildingPulse is a lightweight web-based decision-support tool for commercial building HVAC analysis.

Users upload time-series HVAC and occupancy data, and the application identifies potential operational inefficiencies such as:

- unoccupied HVAC energy use
- extended startup/shutdown periods
- closed-day HVAC activity
- high unoccupied HVAC demand

The tool processes data locally in the browser and provides energy/cost metrics, diagnostic findings, and prioritized recommendations.

## Project Context

Developed as part of the IBM SkillsBuild Micro-Internship for Trane Technologies.

## MVP Workflow

Configure Building -> Upload CSV -> Validate -> Analyze -> Review Findings -> Review Recommendations

## Sample Data

Use [`sample-data/buildingpulse_test_after_hours.csv`](sample-data/buildingpulse_test_after_hours.csv)
to test CSV upload, validation, hourly interval handling, and after-hours HVAC patterns.

## Running Unit Tests

Install dependencies first:

```bash
npm install
```

Run the automated unit tests:

```bash
npm test
```

The current unit tests cover core HVAC energy calculations, interval-duration handling,
occupied/unoccupied energy totals, electricity costs, zero-demand intervals, zero
electricity rates, and invalid interval-duration behavior.

For test development, run Vitest in watch mode:

```bash
npx vitest
```

To verify the production build still compiles:

```bash
npm run build
```

## Documentation

See [`docs/PRD.md`](docs/PRD.md) for the full product requirements.

## Status

MVP development in progress.
