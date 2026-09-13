import { describe, expect, it } from 'vitest';

import {
  HVAC_ACTIVITY_THRESHOLD,
  calculateDailyHvacActivityThreshold,
  calculateDailyMaximumHvacDemand,
  calculateDailySignificantActivityThreshold,
  isSignificantHvacActivity,
} from './hvacActivity';

describe('HVAC activity threshold', () => {
  it('defines the prototype threshold as 10% of daily maximum HVAC demand', () => {
    expect(HVAC_ACTIVITY_THRESHOLD).toBe(0.1);
    expect(calculateDailySignificantActivityThreshold(80)).toBe(8);
  });

  it('calculates daily maximum demand and significant activity threshold from records', () => {
    const threshold = calculateDailyHvacActivityThreshold([
      { hvacKw: 3 },
      { hvacKw: 60 },
      { hvacKw: 12 },
    ]);

    expect(calculateDailyMaximumHvacDemand([{ hvacKw: 3 }, { hvacKw: 60 }])).toBe(60);
    expect(threshold).toEqual({
      dailyMaximumHvacDemandKw: 60,
      dailySignificantActivityThresholdKw: 6,
    });
  });

  it('treats records at or above the daily threshold as significant activity', () => {
    expect(isSignificantHvacActivity({ hvacKw: 5.9 }, 6)).toBe(false);
    expect(isSignificantHvacActivity({ hvacKw: 6 }, 6)).toBe(true);
    expect(isSignificantHvacActivity({ hvacKw: 10 }, 6)).toBe(true);
  });
});
