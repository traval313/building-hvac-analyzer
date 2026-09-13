import { describe, expect, it } from 'vitest';

import { HvacCsvRecord } from '../types/csvUpload';
import { calculateHvacEnergySummary } from './hvacEnergy';
import {
  analyzeClosedDayActivity,
  analyzeStartupShutdown,
  analyzeUnoccupiedEnergy,
  analyzeUnoccupiedLoadRatio,
} from './diagnostics';

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
    expect(diagnostic.severity).toBe('high');
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
    expect(diagnostic.severity).toBe('low');
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
    expect(fullyOccupied.severity).toBe('low');
    expect(fullyUnoccupied.unoccupiedEnergyShare).toBe(100);
    expect(fullyUnoccupied.severity).toBe('high');
  });

  it('classifies exact unoccupied-energy threshold boundaries from calculated shares', () => {
    const diagnosticForUnoccupiedKwh = (unoccupiedKwh: number) =>
      analyzeUnoccupiedEnergy(
        calculateHvacEnergySummary(
          [
            makeRecord({
              sourceRow: 2,
              timestampMs: Date.UTC(2026, 0, 1, 8),
              intervalHours: 1,
              occupied: true,
              hvacKw: 100 - unoccupiedKwh,
            }),
            makeRecord({
              sourceRow: 3,
              timestampMs: Date.UTC(2026, 0, 1, 9),
              intervalHours: 1,
              occupied: false,
              hvacKw: unoccupiedKwh,
            }),
          ],
          0.2,
        ),
      );

    expect(diagnosticForUnoccupiedKwh(4.99).severity).toBe('low');
    expect(diagnosticForUnoccupiedKwh(5).severity).toBe('moderate');
    expect(diagnosticForUnoccupiedKwh(15).severity).toBe('moderate');
    expect(diagnosticForUnoccupiedKwh(15.01).severity).toBe('high');
  });
});

describe('analyzeClosedDayActivity', () => {
  it('sums interval energy on configured closed days and calculates share', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 3, 20),
          intervalHours: 2,
          occupied: false,
          hvacKw: 10,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 4, 20),
          intervalHours: 1,
          occupied: false,
          hvacKw: 5,
        }),
        makeRecord({
          sourceRow: 4,
          timestampMs: Date.UTC(2026, 0, 5, 20),
          intervalHours: 3,
          occupied: true,
          hvacKw: 25,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeClosedDayActivity(summary, [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ]);

    expect(diagnostic.closedDays).toEqual(['Sunday', 'Saturday']);
    expect(diagnostic.closedDayEnergyKwh).toBe(25);
    expect(diagnostic.closedDayEnergyShare).toBe(25);
    expect(diagnostic.severity).toBe('high');
  });

  it('classifies closed-day energy share using MVP thresholds', () => {
    const moderateSummary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 3, 20),
          intervalHours: 1,
          occupied: false,
          hvacKw: 3,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 5, 20),
          intervalHours: 1,
          occupied: true,
          hvacKw: 97,
        }),
      ],
      0.2,
    );
    const highSummary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 3, 20),
          intervalHours: 1,
          occupied: false,
          hvacKw: 11,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 5, 20),
          intervalHours: 1,
          occupied: true,
          hvacKw: 89,
        }),
      ],
      0.2,
    );

    expect(analyzeClosedDayActivity(moderateSummary, ['Monday']).severity).toBe('moderate');
    expect(analyzeClosedDayActivity(highSummary, ['Monday']).severity).toBe('high');
  });

  it('handles zero total HVAC energy safely', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 3, 20),
          intervalHours: 1,
          occupied: false,
          hvacKw: 0,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeClosedDayActivity(summary, ['Monday']);

    expect(diagnostic.closedDayEnergyKwh).toBe(0);
    expect(diagnostic.closedDayEnergyShare).toBe(0);
    expect(diagnostic.severity).toBe('low');
    expect(Number.isFinite(diagnostic.closedDayEnergyShare)).toBe(true);
  });

  it('returns zero activity when configured closed days have no records', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 5, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 50,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeClosedDayActivity(summary, [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ]);

    expect(diagnostic.closedDays).toEqual(['Sunday', 'Saturday']);
    expect(diagnostic.closedDayEnergyKwh).toBe(0);
    expect(diagnostic.closedDayEnergyShare).toBe(0);
    expect(diagnostic.severity).toBe('low');
  });

  it('uses custom operating-day configurations to identify closed days', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 4, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 20,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 5, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 30,
        }),
        makeRecord({
          sourceRow: 4,
          timestampMs: Date.UTC(2026, 0, 6, 8),
          intervalHours: 1,
          occupied: false,
          hvacKw: 50,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeClosedDayActivity(summary, ['Sunday', 'Monday']);

    expect(diagnostic.closedDays).toEqual([
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
    expect(diagnostic.closedDayEnergyKwh).toBe(50);
    expect(diagnostic.closedDayEnergyShare).toBe(50);
    expect(diagnostic.severity).toBe('high');
  });
});

describe('analyzeUnoccupiedLoadRatio', () => {
  it('compares average unoccupied demand to average occupied demand', () => {
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
          intervalHours: 3,
          occupied: true,
          hvacKw: 60,
        }),
        makeRecord({
          sourceRow: 4,
          timestampMs: Date.UTC(2026, 0, 1, 12),
          intervalHours: 0.5,
          occupied: false,
          hvacKw: 20,
        }),
        makeRecord({
          sourceRow: 5,
          timestampMs: Date.UTC(2026, 0, 1, 12, 30),
          intervalHours: 0.5,
          occupied: false,
          hvacKw: 30,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeUnoccupiedLoadRatio(summary);

    expect(diagnostic.averageOccupiedDemandKw).toBe(50);
    expect(diagnostic.averageUnoccupiedDemandKw).toBe(25);
    expect(diagnostic.unoccupiedLoadRatio).toBe(50);
    expect(diagnostic.severity).toBe('moderate');
    expect(diagnostic.occupiedRecordCount).toBe(2);
    expect(diagnostic.unoccupiedRecordCount).toBe(2);
  });

  it('classifies unoccupied load ratio using MVP thresholds', () => {
    const lowSummary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 100,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 9),
          intervalHours: 1,
          occupied: false,
          hvacKw: 19,
        }),
      ],
      0.2,
    );
    const highSummary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: true,
          hvacKw: 100,
        }),
        makeRecord({
          sourceRow: 3,
          timestampMs: Date.UTC(2026, 0, 1, 9),
          intervalHours: 1,
          occupied: false,
          hvacKw: 51,
        }),
      ],
      0.2,
    );

    expect(analyzeUnoccupiedLoadRatio(lowSummary).severity).toBe('low');
    expect(analyzeUnoccupiedLoadRatio(highSummary).severity).toBe('high');
  });

  it('handles missing and zero occupied demand without returning NaN or Infinity', () => {
    const noOccupiedSummary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: false,
          hvacKw: 25,
        }),
      ],
      0.2,
    );
    const zeroOccupiedSummary = calculateHvacEnergySummary(
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
          hvacKw: 25,
        }),
      ],
      0.2,
    );

    expect(analyzeUnoccupiedLoadRatio(noOccupiedSummary).unoccupiedLoadRatio).toBe(0);
    expect(analyzeUnoccupiedLoadRatio(zeroOccupiedSummary).unoccupiedLoadRatio).toBe(0);
    expect(Number.isFinite(analyzeUnoccupiedLoadRatio(noOccupiedSummary).unoccupiedLoadRatio)).toBe(
      true,
    );
    expect(Number.isFinite(analyzeUnoccupiedLoadRatio(zeroOccupiedSummary).unoccupiedLoadRatio)).toBe(
      true,
    );
  });

  it('handles datasets with no unoccupied records safely', () => {
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
          intervalHours: 1,
          occupied: true,
          hvacKw: 60,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeUnoccupiedLoadRatio(summary);

    expect(diagnostic.averageOccupiedDemandKw).toBe(50);
    expect(diagnostic.averageUnoccupiedDemandKw).toBe(0);
    expect(diagnostic.unoccupiedLoadRatio).toBe(0);
    expect(diagnostic.occupiedRecordCount).toBe(2);
    expect(diagnostic.unoccupiedRecordCount).toBe(0);
    expect(diagnostic.severity).toBe('low');
    expect(Number.isFinite(diagnostic.unoccupiedLoadRatio)).toBe(true);
  });

  it('returns the established unavailable state when occupied demand is unavailable', () => {
    const summary = calculateHvacEnergySummary(
      [
        makeRecord({
          sourceRow: 2,
          timestampMs: Date.UTC(2026, 0, 1, 8),
          intervalHours: 1,
          occupied: false,
          hvacKw: 25,
        }),
      ],
      0.2,
    );

    const diagnostic = analyzeUnoccupiedLoadRatio(summary);

    expect(diagnostic.averageOccupiedDemandKw).toBe(0);
    expect(diagnostic.averageUnoccupiedDemandKw).toBe(25);
    expect(diagnostic.unoccupiedLoadRatio).toBe(0);
    expect(diagnostic.occupiedRecordCount).toBe(0);
    expect(diagnostic.unoccupiedRecordCount).toBe(1);
    expect(diagnostic.severity).toBe('low');
    expect(Number.isFinite(diagnostic.unoccupiedLoadRatio)).toBe(true);
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
    expect(diagnostic.postOccupancySeverity).toBe('moderate');
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
    expect(diagnostic.postOccupancySeverity).toBe('low');
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

    expect(analyzeStartupShutdown(summary).postOccupancySeverity).toBe('high');
  });
});
