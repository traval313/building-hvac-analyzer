Product Requirements Document

Commercial Building HVAC Operations Advisor

Version: 1.0

Status: MVP - Development Specification

Project: IBM SkillsBuild Micro-Internship - Trane Technologies

Document Purpose: Define the requirements, scope, analytical methodology, technical constraints, and acceptance criteria for the BuildingPulse MVP

## Product Overview

A lightweight web-based decision-support application for analyzing HVAC operational efficiency in commercial buildings.

Facility managers can provide basic building information and upload a CSV containing time-series HVAC, occupancy, and optional temperature data. The app processes the data locally, identifies potential operational inefficiencies, quantifies relevant energy and cost metrics, and provides prioritized findings and recommended areas of investigation.

The MVP focuses specifically on the relationship between HVAC operation and building occupancy.

This app is not intended to replace a Building Automation System (BAS), professional building-energy audit, commissioning process, or engineering analysis. It provides preliminary operational insights based only on the information supplied by the user.

## Background

Commercial HVAC systems represent a significant portion of building energy consumption. Energy performance depends not only on equipment efficiency but also on how equipment is operated.

Potential operational issues include:

- HVAC operation during unoccupied periods
- Unnecessarily extended operation after occupancy
- Excessive pre-occupancy operation
- HVAC operation during normally closed days
- High HVAC demand while a building is unoccupied

Modern building-management and analytics platforms transform operational building data into information that facility managers can use to investigate these conditions

This web app will implement a deliberately narrow version of this workflow:

Building data -> validation -> analysis -> findings -> recommended actions

The project demonstrates how locally supplied operational data can be transformed into useful facility-management decision support without requiring integration with proprietary building systems.

## Problem Statement

Facility managers may have access to basic HVAC, energy, schedule, and occupancy data but lack an accessible way to quickly interpret those data.

Raw measurements along do not clearly answer questions such as:

- How much HVAC energy is consumed while the building is unoccupied?
- Does HVAC operation regularly continue after occupants leave?
- Does significant HVAC activity occur on normally closed days?
- How large is unoccupied HVAC demand relative to occupied demand?
- Which observed pattern deserves investigation first?
- What financial cost is associated with the identified periods?

This web app will address this problem by automatically analyzing user-provided operational data and converting it into understandable metrics, prioritized findings, and recommended areas for further investigation.

## Target User

Primary User: a facility manager or building-operations professional responsible for a commercial building. The user is assumed to understand basic information about their facility, such as:

- Building type
- Normal operating days
- Occupancy patterns
- Electricity cost
- HVAC operation

The user may have access to an export of historical building/HVAC data but may not have access to sophisticated building analytics software or the expertise/time required to manually analyze the dataset

## Product Goal

The MVP should enable a user to:

- Configure basic building information.
- Upload a supported CSV dataset.
- Validate whether the dataset can be analyzed.
- Calculate HVAC energy from time-series demand data.
- Identify four categories of potential operational inefficiency.
- Understand the energy and financial significance of observed conditions.
- Identify which findings deserve the most attention.
- Receive appropriate recommendations for further investigation.

## Step 1 - Configure Building

User enters:

- Building name
- Building type
- Electricity rate ($/kWh)
- Normally occupied/operating days

## Step 2 - Upload Data

The user uploads a CSV containing time-series HVAC and occupancy data.

## Step 3 - Validate

BuildingPulse validates the file structure and data.

If validation fails, the user receives actionable error messages.

## Step 4 - Analyze

BuildingPulse:

- determines measurement intervals
- converts HVAC power into energy
- separates occupied and unoccupied periods
- identifies closed-day periods
- analyzes HVAC startup/shutdown behavior
- compares occupied and unoccupied HVAC demand

## Step 5 - Generate Findings

The application generates four diagnostic results.

## Step 6 - Prioritize

Each diagnostic is assigned an MVP-defined review severity:

- Low
- Moderate
- High

## Step 7 - Recommend

The application provides recommendations corresponding to detected conditions.

## Step 8 - Visualize

The user reviews:

- building summary
- overall finding
- diagnostic cards
- energy/cost metrics
- charts
- recommended actions
- methodology/disclaimer

## Input Requirements

### Building Configuration

Required configuration fields:

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| Building name | String | Yes | Non-empty |
| Building type | Selection/String | Yes | Supported/non-empty value |
| Electricity rate | Number | Yes | >= 0 |
| Normal operating days | Day selection | Yes | At least one day |

The MVP does not require annual electricity consumption or an estimated HVAC percentage because HVAC demand is provided directly by the uploaded dataset.

### CSV Data Contract

Required Schema

```csv
timestamp,occupied,hvac_kw,indoor_temp_f,outdoor_temp_f
2026-08-03 07:00,false,32,76,71
2026-08-03 08:00,true,51,73,73
2026-08-03 09:00,true,58,72,75
```

Fields

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| timestamp | Yes | Datetime | Beginning of measurement interval |
| occupied | Yes | Boolean | Whether building is occupied |
| hvac_kw | Yes | Number >= 0 | Average HVAC electrical demand during interval |
| indoor_temp_f | No | Number | Indoor temperature |
| outdoor_temp_f | No | Number | Outdoor temperature |

Temperature fields are accepted for future analysis and contextual visualization but are not required by the four core MVP diagnostics.

## Data Validation Requirements

The application must validate uploaded data before analysis.

Validation should detect at minimum:

- missing required columns
- empty file
- malformed CSV
- invalid timestamps
- duplicate timestamps
- missing required values
- invalid occupancy values
- negative HVAC demand
- nonnumeric HVAC demand
- insufficient data
- intervals that cannot reasonably be calculated

The MVP requires at least 24 hours of valid observations.

Rows should be normalized and ordered chronologically before analysis.

The application must not silently ignore serious validation failures.

Where reasonable, nonfatal data-quality issues may generate warnings instead of preventing analysis.

Example:

Error:

Missing required column: hvac_kw

Warning:

3 duplicate timestamps were detected.

## Energy Calculation Methodology

The dataset supplies HVAC electrical demand in kilowatts. Because kilowatts represent power rather than energy, the app must account for measurement duration.

For interval i: HVAC Energy (kWh) = HVAC Power (kW) x Interval Duration (hours)

Example: 40 kW sustained over a 15-minute interval: 40 x 0.25 = 10 kWh

The application must therefore derive or validate the duration between measurements. The implementation must not assume that summing hvac_kw values produces energy.

## Core Diagnostic Engine

### Diagnostic 1 - Unoccupied HVAC Energy

Question

How much observed HVAC energy consumption occurred while the building was marked unoccupied?

Calculation

Unoccupied HVAC Energy = Sum of interval HVAC energy where occupied = false

Unoccupied Energy Share = Unoccupied HVAC Energy / Total HVAC Energy x 100

Example

Total HVAC energy: 30,000 kWh

Unoccupied HVAC energy: 4,500 kWh

Result: 15% of observed HVAC energy occurred during unoccupied periods.

Interpretation

The application must not classify all unoccupied HVAC energy as waste. HVAC operation may be required for:

- preconditioning
- ventilation
- humidity control
- equipment protection
- cleaning/maintenance
- after-hours occupancy
- other operational requirements

The result identifies energy consumption that may deserve investigation.

### Diagnostic 2 - Startup & Shutdown Analysis

Question

How long does significant HVAC operation occur before and after occupied periods?

For each occupied operating day, determine:

- first occupied timestamp
- last occupied timestamp
- first significant HVAC activity
- last significant HVAC activity

Calculate:

Pre-Occupancy Runtime = Occupancy Start - HVAC Activity Start

Post-Occupancy Runtime = HVAC Activity End - Occupancy End

Aggregate results across valid occupied days. Report:

- average pre-occupancy HVAC runtime
- average post-occupancy HVAC runtime

Important Interpretation

Pre-occupancy HVAC operation must not automatically be classified as waste because buildings may require time to reach appropriate occupied conditions.

Post-occupancy operation also requires investigation rather than automatic classification as unnecessary.

### Significant HVAC Activity Definition

HVAC demand may not reach exactly zero; For purposes of detecting startup and shutdown, the MVP defines significant HVAC activity as:

HVAC demand >= 10% of that day's maximum HVAC demand

The 10% threshold is an MVP prototype assumption, not an industry performance standard.

### Diagnostic 3 - Closed-Day / Weekend HVAC Activity

Question

How much HVAC energy is consumed during days the user identifies as normally closed?

Calculation

Closed-Day Energy = Sum of HVAC interval energy occurring on normally closed days

Closed-Day Energy Share = Closed-Day HVAC Energy / Total HVAC Energy x 100

Interpretation

Closed-day energy must not automatically be classified as waste. Possible explanations include:

- special events
- cleaning
- maintenance
- schedule overrides
- equipment/environmental requirements
- unexpected occupancy

The finding should recommend verification rather than automatic shutdown.

### Diagnostic 4 - Unoccupied Load Intensity

Question

How large is average HVAC demand while the building is unoccupied compared with average demand while occupied?

Calculate:

Average Occupied Demand = Mean hvac_kw where occupied = true

Average Unoccupied Demand = Mean hvac_kw where occupied = false

Unoccupied Load Ratio = Average Unoccupied Demand / Average Occupied Demand x 100

Purpose

This diagnostic distinguishes between:

- HVAC equipment technically remaining active at a low level
- substantial HVAC demand continuing while the building is unoccupied

Example: Average occupied demand: 58 kW

Average unoccupied demand: 35 kW

Unoccupied load ratio: 60.3%

The result indicates that unoccupied HVAC demand remains relatively high compared with occupied operation and may deserve investigation.

## Review Severity System

Each diagnostic receives one of three review levels:

- Low
- Moderate
- High

For the MVP, use the following thresholds:

| Diagnostic | Low | Moderate | High |
| --- | --- | --- | --- |
| Unoccupied energy share | <5% | 5-15% | >15% |
| Average post-occupancy runtime | <1 hr | 1-2 hr | >2 hr |
| Closed-day energy share | <3% | 3-10% | >10% |
| Unoccupied load ratio | <20% | 20-50% | >50% |

Boundary behavior must be explicitly defined in implementation and tested. For example, values exactly equal to 15% must deterministically belong to one category.

### Critical Disclaimer

These thresholds are prototype-defined review heuristics.

They are not presented as:

- Trane standards
- DOE standards
- ENERGY STAR standards
- ASHRAE standards
- engineering performance requirements

Their purpose is only to prioritize findings inside the MVP. Threshold values should therefore be centralized in configuration/constants so they can be changed without modifying diagnostic algorithms.

## Cost Analysis

The application may calculate the electricity cost associated with observed energy. For any energy quantity:

Cost = Energy (kWh) x Electricity Rate ($/kWh)

Example: Unoccupied HVAC energy: 4,500 kWh

Electricity rate: $0.15/kWh

Observed unoccupied HVAC electricity cost: $675

The application should use language such as:

"$675 of observed HVAC electricity cost during this analysis period occurred during unoccupied periods."

The application must NOT state:

"You can save $675."

Observed consumption is not equivalent to avoidable consumption.

## Optional Savings Scenario

The MVP may include a clearly labeled scenario-analysis feature. The user may select an assumed avoidable fraction of identified unoccupied HVAC consumption.

Example: If 25% of identified unoccupied HVAC energy could be avoided...

Calculate: Scenario Energy Opportunity = Unoccupied HVAC Energy x Assumed Avoidable Fraction

Scenario Cost Opportunity = Scenario Energy Opportunity x Electricity Rate

The interface must make clear that this is a hypothetical scenario and not predicted or guaranteed savings. This feature is secondary to the four diagnostics and should only be implemented after core MVP requirements are complete.

## Recommendation Engine

Recommendations must be generated from diagnostic findings rather than displaying identical generic recommendations for every building.

Examples: High Unoccupied Energy

Recommendation: Review HVAC scheduling, occupancy overrides, and after-hours operational requirements to determine what is driving unoccupied consumption.

Extended Post-Occupancy Operation

Recommendation: Investigate evening shutdown schedules and determine whether after-hours occupancy or operational requirements justify continued HVAC operation.

High Closed-Day Activity

Recommendation: Verify weekend/closed-day schedules and determine whether maintenance, cleaning, special events, or schedule overrides explain the observed HVAC activity.

High Unoccupied Load Ratio

Recommendation: Investigate temperature setbacks, ventilation requirements, schedule overrides, control settings, and equipment operation during unoccupied periods.

Recommendations should encourage investigation rather than prescribe unsafe or unsupported equipment changes.

## Results Dashboard Requirements

The results interface should contain five primary sections.

### Building Summary

Display:

- building name
- building type
- analysis date range
- number of valid records analyzed
- electricity rate
- configured operating days

### Overall Finding

Summarize whether the analysis indicates:

- Low concern
- Review suggested
- Priority review suggested

The overall classification should derive transparently from the four diagnostic severities. The exact aggregation rule must be documented and tested before implementation.

### Diagnostic Cards

Display one card for each diagnostic. Each card should contain:

- diagnostic name
- primary metric
- Low / Moderate / High classification
- short explanation
- relevant supporting metric(s)

### Energy & Cost Summary

Display relevant observed values including:

- total HVAC energy
- occupied HVAC energy
- unoccupied HVAC energy
- closed-day HVAC energy
- associated electricity costs

### Recommended Actions

Display recommendations prioritized according to diagnostic severity. High-priority findings should appear before Moderate and Low findings.

## Visualization Requirements

The MVP should include at least two useful visualizations.

### Visualization 1 - HVAC Demand Over Time

Display HVAC demand across the selected analysis period with occupied/unoccupied periods visually distinguishable. Purpose: Help users visually identify HVAC operation outside occupancy.

### Visualization 2 - Occupied vs. Unoccupied Energy

Compare HVAC energy consumed during:

- occupied periods
- unoccupied periods

Visualizations should clarify findings rather than exist purely for presentation.

## Technical Direction

Recommended MVP stack:

- React
- Vite
- TypeScript preferred; JavaScript acceptable
- CSV parsing library
- charting library suitable for React
- unit-testing framework compatible with the selected stack
