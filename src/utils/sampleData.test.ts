import { describe, expect, it } from 'vitest';

import { OperatingDay } from '../types/buildingConfig';
import afterHoursIssueCsv from '../../sample-data/after-hours-issue.csv?raw';
import efficientBuildingCsv from '../../sample-data/efficient-building.csv?raw';
import weekendIssueCsv from '../../sample-data/weekend-issue.csv?raw';
import {
  analyzeClosedDayActivity,
  analyzeStartupShutdown,
  analyzeUnoccupiedEnergy,
  analyzeUnoccupiedLoadRatio,
} from './diagnostics';
import { parseCsvText } from './csvParser';
import { calculateHvacEnergySummary } from './hvacEnergy';

const electricityRate = 0.15;
const normalOperatingDays: OperatingDay[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

type ExpectedSampleDatasetResult = {
  filename: string;
  totalKwh: number;
  occupiedKwh: number;
  unoccupiedKwh: number;
  unoccupiedShare: number;
  unoccupiedCost: number;
  averagePreHours: number;
  averagePostHours: number;
  closedDayKwh: number;
  closedDayShare: number;
  averageOccupiedKw: number;
  averageUnoccupiedKw: number;
  unoccupiedLoadRatio: number;
  severities: {
    diagnostic1: 'low' | 'moderate' | 'high';
    diagnostic2: 'low' | 'moderate' | 'high';
    diagnostic3: 'low' | 'moderate' | 'high';
    diagnostic4: 'low' | 'moderate' | 'high';
  };
};

const sampleData: Record<string, string> = {
  'efficient-building.csv': efficientBuildingCsv,
  'after-hours-issue.csv': afterHoursIssueCsv,
  'weekend-issue.csv': weekendIssueCsv,
};

const expectedResults: ExpectedSampleDatasetResult[] = [
  {
    filename: 'efficient-building.csv',
    totalKwh: 2661.6,
    occupiedKwh: 2570,
    unoccupiedKwh: 91.6,
    unoccupiedShare: 3.44,
    unoccupiedCost: 13.74,
    averagePreHours: 1,
    averagePostHours: 0,
    closedDayKwh: 9.6,
    closedDayShare: 0.36,
    averageOccupiedKw: 51.4,
    averageUnoccupiedKw: 0.78,
    unoccupiedLoadRatio: 1.51,
    severities: {
      diagnostic1: 'low',
      diagnostic2: 'low',
      diagnostic3: 'low',
      diagnostic4: 'low',
    },
  },
  {
    filename: 'after-hours-issue.csv',
    totalKwh: 4461,
    occupiedKwh: 2870,
    unoccupiedKwh: 1591,
    unoccupiedShare: 35.66,
    unoccupiedCost: 238.65,
    averagePreHours: 8,
    averagePostHours: 6,
    closedDayKwh: 96,
    closedDayShare: 2.15,
    averageOccupiedKw: 57.4,
    averageUnoccupiedKw: 13.48,
    unoccupiedLoadRatio: 23.49,
    severities: {
      diagnostic1: 'high',
      diagnostic2: 'high',
      diagnostic3: 'low',
      diagnostic4: 'moderate',
    },
  },
  {
    filename: 'weekend-issue.csv',
    totalKwh: 3506,
    occupiedKwh: 2570,
    unoccupiedKwh: 936,
    unoccupiedShare: 26.7,
    unoccupiedCost: 140.4,
    averagePreHours: 1,
    averagePostHours: 0,
    closedDayKwh: 854,
    closedDayShare: 24.36,
    averageOccupiedKw: 51.4,
    averageUnoccupiedKw: 7.93,
    unoccupiedLoadRatio: 15.43,
    severities: {
      diagnostic1: 'high',
      diagnostic2: 'low',
      diagnostic3: 'high',
      diagnostic4: 'low',
    },
  },
];

const expectFiniteNumbers = (value: unknown) => {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(expectFiniteNumbers);
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach(expectFiniteNumbers);
  }
};

describe('sample HVAC datasets', () => {
  it.each(expectedResults)('$filename validates and produces expected diagnostics', (expected) => {
    const parseResult = parseCsvText(sampleData[expected.filename]);

    expect(parseResult.errors).toEqual([]);
    expect(parseResult.records).toHaveLength(168);
    expect(parseResult.records.every((record) => record.intervalHours === 1)).toBe(true);
    expect(parseResult.records.every((record) => record.hvacKw >= 0)).toBe(true);
    expect(parseResult.records.every((record) => typeof record.occupied === 'boolean')).toBe(true);

    const energySummary = calculateHvacEnergySummary(parseResult.records, electricityRate);
    const unoccupiedEnergy = analyzeUnoccupiedEnergy(energySummary);
    const startupShutdown = analyzeStartupShutdown(energySummary);
    const closedDayActivity = analyzeClosedDayActivity(energySummary, normalOperatingDays);
    const unoccupiedLoadRatio = analyzeUnoccupiedLoadRatio(energySummary);

    expectFiniteNumbers({
      energySummary,
      unoccupiedEnergy,
      startupShutdown,
      closedDayActivity,
      unoccupiedLoadRatio,
    });

    expect(energySummary.totalHvacEnergyKwh).toBeCloseTo(expected.totalKwh, 2);
    expect(energySummary.occupiedHvacEnergyKwh).toBeCloseTo(expected.occupiedKwh, 2);
    expect(energySummary.unoccupiedHvacEnergyKwh).toBeCloseTo(expected.unoccupiedKwh, 2);

    expect(unoccupiedEnergy.unoccupiedEnergyShare).toBeCloseTo(expected.unoccupiedShare, 2);
    expect(unoccupiedEnergy.unoccupiedCost).toBeCloseTo(expected.unoccupiedCost, 2);
    expect(unoccupiedEnergy.severity).toBe(expected.severities.diagnostic1);

    expect(startupShutdown.averagePreOccupancyRuntimeHours).toBeCloseTo(
      expected.averagePreHours,
      2,
    );
    expect(startupShutdown.averagePostOccupancyRuntimeHours).toBeCloseTo(
      expected.averagePostHours,
      2,
    );
    expect(startupShutdown.analyzedDayCount).toBe(5);
    expect(startupShutdown.postOccupancySeverity).toBe(expected.severities.diagnostic2);

    expect(closedDayActivity.closedDays).toEqual(['Sunday', 'Saturday']);
    expect(closedDayActivity.closedDayEnergyKwh).toBeCloseTo(expected.closedDayKwh, 2);
    expect(closedDayActivity.closedDayEnergyShare).toBeCloseTo(expected.closedDayShare, 2);
    expect(closedDayActivity.severity).toBe(expected.severities.diagnostic3);

    expect(unoccupiedLoadRatio.averageOccupiedDemandKw).toBeCloseTo(
      expected.averageOccupiedKw,
      2,
    );
    expect(unoccupiedLoadRatio.averageUnoccupiedDemandKw).toBeCloseTo(
      expected.averageUnoccupiedKw,
      2,
    );
    expect(unoccupiedLoadRatio.unoccupiedLoadRatio).toBeCloseTo(
      expected.unoccupiedLoadRatio,
      2,
    );
    expect(unoccupiedLoadRatio.severity).toBe(expected.severities.diagnostic4);
  });
});
