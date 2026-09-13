import { describe, expect, it } from 'vitest';

import { HvacCsvRecord } from '../types/csvUpload';
import {
  calculateElectricityCost,
  calculateHvacEnergySummary,
  calculateIntervalHvacEnergyKwh,
} from './hvacEnergy';

const makeRecord = ({
  sourceRow,
  timestampMs,
  intervalHours,
  occupied,
  hvacKw,
}: {
  sourceRow: number;
  timestampMs: number;
  intervalHours: number;
  occupied: boolean;
  hvacKw: number;
}): HvacCsvRecord => {
  const intervalMs = intervalHours * 3_600_000;
  const intervalEndMs = timestampMs + intervalMs;

  return {
    sourceRow,
    timestamp: new Date(timestampMs),
    timestampMs,
    intervalEnd: new Date(intervalEndMs),
    intervalEndMs,
    intervalMs,
    intervalHours,
    intervalSource: 'next-record',
    occupied,
    hvacKw,
  };
};

describe('calculateIntervalHvacEnergyKwh', () => {
  it('calculates hourly interval energy', () => {
    expect(calculateIntervalHvacEnergyKwh(40, 1)).toBe(40);
  });

  it('calculates 30-minute interval energy', () => {
    expect(calculateIntervalHvacEnergyKwh(40, 0.5)).toBe(20);
  });

  it('calculates 15-minute interval energy', () => {
    expect(calculateIntervalHvacEnergyKwh(40, 0.25)).toBe(10);
  });

  it('returns zero energy for zero HVAC demand', () => {
    expect(calculateIntervalHvacEnergyKwh(0, 0.25)).toBe(0);
  });

  it('preserves current numeric behavior for invalid interval durations', () => {
    expect(calculateIntervalHvacEnergyKwh(40, 0)).toBe(0);
    expect(calculateIntervalHvacEnergyKwh(40, -0.5)).toBe(-20);
    expect(calculateIntervalHvacEnergyKwh(40, Number.NaN)).toBeNaN();
    expect(calculateIntervalHvacEnergyKwh(40, Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('calculateElectricityCost', () => {
  it('returns zero cost when the electricity rate is zero', () => {
    expect(calculateElectricityCost(40, 0)).toBe(0);
  });
});

describe('calculateHvacEnergySummary', () => {
  it('uses each record interval duration instead of assuming hourly data', () => {
    const records = [
      makeRecord({
        sourceRow: 2,
        timestampMs: Date.UTC(2026, 0, 1, 8),
        intervalHours: 1,
        occupied: true,
        hvacKw: 40,
      }),
      makeRecord({
        sourceRow: 3,
        timestampMs: Date.UTC(2026, 0, 1, 9),
        intervalHours: 0.5,
        occupied: true,
        hvacKw: 40,
      }),
      makeRecord({
        sourceRow: 4,
        timestampMs: Date.UTC(2026, 0, 1, 9, 30),
        intervalHours: 0.25,
        occupied: true,
        hvacKw: 40,
      }),
    ];

    const summary = calculateHvacEnergySummary(records, 0.15);

    expect(summary.intervals.map((interval) => interval.intervalHvacEnergyKwh)).toEqual([
      40, 20, 10,
    ]);
    expect(summary.totalHvacEnergyKwh).toBe(70);
  });

  it('calculates known occupied, unoccupied, total energy, and electricity costs', () => {
    const records = [
      makeRecord({
        sourceRow: 2,
        timestampMs: Date.UTC(2026, 0, 1, 8),
        intervalHours: 1,
        occupied: true,
        hvacKw: 40,
      }),
      makeRecord({
        sourceRow: 3,
        timestampMs: Date.UTC(2026, 0, 1, 9),
        intervalHours: 0.5,
        occupied: false,
        hvacKw: 20,
      }),
      makeRecord({
        sourceRow: 4,
        timestampMs: Date.UTC(2026, 0, 1, 9, 30),
        intervalHours: 0.25,
        occupied: true,
        hvacKw: 12,
      }),
      makeRecord({
        sourceRow: 5,
        timestampMs: Date.UTC(2026, 0, 1, 9, 45),
        intervalHours: 0.25,
        occupied: false,
        hvacKw: 0,
      }),
    ];

    const summary = calculateHvacEnergySummary(records, 0.2);

    expect(summary.totalHvacEnergyKwh).toBe(53);
    expect(summary.occupiedHvacEnergyKwh).toBe(43);
    expect(summary.unoccupiedHvacEnergyKwh).toBe(10);
    expect(summary.electricityCost).toBeCloseTo(10.6);
    expect(summary.occupiedElectricityCost).toBeCloseTo(8.6);
    expect(summary.unoccupiedElectricityCost).toBe(2);
    expect(summary.totalHvacEnergyKwh).toBeCloseTo(
      summary.occupiedHvacEnergyKwh + summary.unoccupiedHvacEnergyKwh,
    );
  });

  it('returns zero costs for valid energy calculations when the electricity rate is zero', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 40,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 9),
          intervalHours: 0.5,
          occupied: false,
          hvacKw: 40,
        }),
      ],
      0,
    );

    expect(summary.totalHvacEnergyKwh).toBe(60);
    expect(summary.electricityCost).toBe(0);
    expect(summary.occupiedElectricityCost).toBe(0);
    expect(summary.unoccupiedElectricityCost).toBe(0);
  });
});
