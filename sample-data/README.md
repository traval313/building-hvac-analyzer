# Synthetic Sample Data

These files are synthetic demo and test data for BuildingPulse. They do not contain real customer, Trane, facility, or personal data.

All three datasets use the supported CSV schema:

```csv
timestamp,occupied,hvac_kw,indoor_temp_f,outdoor_temp_f
```

Common assumptions:

- Analysis period: Monday 2026-09-07 00:00 through Sunday 2026-09-13 23:00
- Interval duration: 1 hour
- Records per file: 168
- Operating days: Monday-Friday
- Occupancy schedule: Monday-Friday, 08:00-18:00; Saturday-Sunday unoccupied
- Electricity rate for expected-cost examples: $0.15/kWh
- Timestamps are local wall-clock timestamps without customer-identifying metadata

Expected results were calculated from the generated CSV files using the current parser, HVAC energy summary, and diagnostic functions.

## efficient-building.csv

Scenario:
HVAC operation generally follows weekday occupancy with a short pre-occupancy startup, quick evening shutdown, and minimal weekend/closed-day activity.

Intended pattern:
This represents a comparatively well-aligned operating profile for reviewers to use as a low-concern baseline.

Expected diagnostic pattern:

| Diagnostic | Expected severity | Expected numeric result |
| --- | --- | --- |
| Diagnostic 1 - Unoccupied HVAC Energy | Low | 91.6 kWh, 3.44%, $13.74 |
| Diagnostic 2 - Startup & Shutdown | Low | 1.00 hr average pre-occupancy, 0.00 hr average post-occupancy |
| Diagnostic 3 - Closed-Day Activity | Low | 9.6 kWh, 0.36% |
| Diagnostic 4 - Unoccupied Load Ratio | Low | 0.78 kW unoccupied avg / 51.40 kW occupied avg = 1.51% |

Additional energy totals:

- Total HVAC energy: 2,661.6 kWh
- Occupied HVAC energy: 2,570.0 kWh
- Unoccupied HVAC energy: 91.6 kWh

## after-hours-issue.csv

Scenario:
HVAC remains active well before and well beyond weekday occupancy, while weekend operation stays low.

Intended pattern:
This dataset demonstrates significant after-hours operation. It should strongly trigger Diagnostic 1 and Diagnostic 2, with a moderate unoccupied load ratio because many unoccupied records still have meaningful HVAC demand.

Expected diagnostic pattern:

| Diagnostic | Expected severity | Expected numeric result |
| --- | --- | --- |
| Diagnostic 1 - Unoccupied HVAC Energy | High | 1,591.0 kWh, 35.66%, $238.65 |
| Diagnostic 2 - Startup & Shutdown | High | 8.00 hr average pre-occupancy, 6.00 hr average post-occupancy |
| Diagnostic 3 - Closed-Day Activity | Low | 96.0 kWh, 2.15% |
| Diagnostic 4 - Unoccupied Load Ratio | Moderate | 13.48 kW unoccupied avg / 57.40 kW occupied avg = 23.49% |

Additional energy totals:

- Total HVAC energy: 4,461.0 kWh
- Occupied HVAC energy: 2,870.0 kWh
- Unoccupied HVAC energy: 1,591.0 kWh

## weekend-issue.csv

Scenario:
Weekday operation is mostly aligned with occupancy, but HVAC runs substantially during Saturday and Sunday when the building is configured as closed.

Intended pattern:
This dataset demonstrates a closed-day/weekend schedule issue. Diagnostic 3 is high. Diagnostic 1 is also high because the weekend HVAC activity occurs while the building is unoccupied under the supplied occupancy schedule.

Expected diagnostic pattern:

| Diagnostic | Expected severity | Expected numeric result |
| --- | --- | --- |
| Diagnostic 1 - Unoccupied HVAC Energy | High | 936.0 kWh, 26.70%, $140.40 |
| Diagnostic 2 - Startup & Shutdown | Low | 1.00 hr average pre-occupancy, 0.00 hr average post-occupancy |
| Diagnostic 3 - Closed-Day Activity | High | 854.0 kWh, 24.36% |
| Diagnostic 4 - Unoccupied Load Ratio | Low | 7.93 kW unoccupied avg / 51.40 kW occupied avg = 15.43% |

Additional energy totals:

- Total HVAC energy: 3,506.0 kWh
- Occupied HVAC energy: 2,570.0 kWh
- Unoccupied HVAC energy: 936.0 kWh
