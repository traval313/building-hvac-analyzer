import { describe, expect, it } from 'vitest';

import { HvacCsvRecord } from '../types/csvUpload';
import { calculateHvacEnergySummary } from './hvacEnergy';
import { analyzeStartupShutdown, analyzeUnoccupiedEnergy } from './diagnostics';

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

describe('analyzeUnoccupiedEnergy', () => {
  it('returns correct unoccupied energy share and observed cost from energy summary totals', () => {
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
          hvacKw: 20,
        }),
        makeRecord({
          sourceRow: 4,
          timestampMs: Date.UTC(2026, 0, 1, 9, 30),
          intervalHours: 0.25,
          occupied: true,
          hvacKw: 12,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeUnoccupiedEnergy(summary);

    expect(diagnostic.unoccupiedEnergyKwh).toBe(10);
    expect(diagnostic.unoccupiedEnergyShare).toBeCloseTo((10 / 53) * 100);
    expect(diagnostic.unoccupiedCost).toBe(2);
    expect(summary.occupiedHvacEnergyKwh + diagnostic.unoccupiedEnergyKwh).toBeCloseTo(
      summary.totalHvacEnergyKwh,
    );
  });

  it('handles zero total HVAC energy without returning NaN or Infinity', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 0,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 9),
          intervalHours: 1,
          occupied: false,
          hvacKw: 0,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeUnoccupiedEnergy(summary);

    expect(diagnostic.unoccupiedEnergyKwh).toBe(0);
    expect(diagnostic.unoccupiedEnergyShare).toBe(0);
    expect(diagnostic.unoccupiedCost).toBe(0);
    expect(Number.isFinite(diagnostic.unoccupiedEnergyShare)).toBe(true);
  });

  it('handles fully occupied and fully unoccupied datasets', () => {
    const fullyOccupied = analyzeUnoccupiedEnergy(
      calculateHvacEnergySummary(
        [
          makeRecord({
            sourceRow: 2,
            timestampMs: Date.UTC(2026, 0, 1, 8),
            intervalHours: 1,
            occupied: true,
            hvacKw: 15,
          }),
        ],
        0.2,
      ),
    );
    const fullyUnoccupied = analyzeUnoccupiedEnergy(
      calculateHvacEnergySummary(
        [
          makeRecord({
            sourceRow: 2,
            timestampMs: Date.UTC(2026, 0, 1, 8),
            intervalHours: 1,
            occupied: false,
            hvacKw: 15,
          }),
        ],
        0.2,
      ),
    );

    expect(fullyOccupied.unoccupiedEnergyShare).toBe(0);
    expect(fullyUnoccupied.unoccupiedEnergyShare).toBe(100);
  });
});

describe('analyzeStartupShutdown', () => {
  it('averages pre- and post-occupancy significant HVAC runtime across valid occupied days', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 10),
          intervalHours: 1,
          occupied: false,
          hvacKw: 2,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 11),
          intervalHours: 1,
          occupied: false,
          hvacKw: 8,
        }),
        makeRecord({
          sourceRow: 4,
          timestampMs: Date.UTC(2026, 0, 1, 13),
          intervalHours: 8,
          occupied: true,
          hvacKw: 60,
        }),
        makeRecord({
          sourceRow: 5,
          timestampMs: Date.UTC(2026, 0, 1, 21),
          intervalHours: 1,
          occupied: false,
          hvacKw: 12,
        }),
        makeRecord({
          sourceRow: 6,
          timestampMs: Date.UTC(2026, 0, 1, 22),
          intervalHours: 1,
          occupied: false,
          hvacKw: 5,
        }),
        makeRecord({
          sourceRow: 7,
          timestampMs: Date.UTC(2026, 0, 2, 10),
          intervalHours: 1,
          occupied: false,
          hvacKw: 10,
        }),
        makeRecord({
          sourceRow: 8,
          timestampMs: Date.UTC(2026, 0, 2, 11),
          intervalHours: 9,
          occupied: true,
          hvacKw: 50,
        }),
        makeRecord({
          sourceRow: 9,
          timestampMs: Date.UTC(2026, 0, 2, 20),
          intervalHours: 3,
          occupied: false,
          hvacKw: 10,
        }),
        makeRecord({
          sourceRow: 10,
          timestampMs: Date.UTC(2026, 0, 3, 8),
          intervalHours: 1,
          occupied: false,
          hvacKw: 20,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeStartupShutdown(summary);

    expect(diagnostic.analyzedDayCount).toBe(2);
    expect(diagnostic.averagePreOccupancyRuntimeHours).toBe(1.5);
    expect(diagnostic.averagePostOccupancyRuntimeHours).toBe(2);
    expect(diagnostic.postOccupancySeverity).toBe('Moderate');
  });

  it('uses each calendar day maximum to determine significant HVAC activity', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 10),
          intervalHours: 1,
          occupied: false,
          hvacKw: 9,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 11),
          intervalHours: 8,
          occupied: true,
          hvacKw: 100,
        }),
        makeRecord({
          sourceRow: 4,
          timestampMs: Date.UTC(2026, 0, 2, 10),
          intervalHours: 1,
          occupied: false,
          hvacKw: 9,
        }),
        makeRecord({
          sourceRow: 5,
          timestampMs: Date.UTC(2026, 0, 2, 11),
          intervalHours: 8,
          occupied: true,
          hvacKw: 80,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeStartupShutdown(summary);

    expect(diagnostic.analyzedDayCount).toBe(2);
    expect(diagnostic.averagePreOccupancyRuntimeHours).toBe(0.5);
  });

  it('handles days without occupancy and zero-demand occupied days safely', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: false,
          hvacKw: 20,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 2, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 0,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeStartupShutdown(summary);

    expect(diagnostic.analyzedDayCount).toBe(0);
    expect(diagnostic.averagePreOccupancyRuntimeHours).toBe(0);
    expect(diagnostic.averagePostOccupancyRuntimeHours).toBe(0);
    expect(diagnostic.postOccupancySeverity).toBe('Low');
  });

  it('classifies average post-occupancy runtime using MVP thresholds', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 8,
          occupied: true,
          hvacKw: 80,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 16),
          intervalHours: 2.5,
          occupied: false,
          hvacKw: 8,
        }),
      ],
      0.2,
    );

    expect(analyzeStartupShutdown(summary).postOccupancySeverity).toBe('High');
  });
});
