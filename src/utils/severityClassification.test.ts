import { describe, expect, it } from 'vitest';

import {
  classifyClosedDayEnergyShare,
  classifyPostOccupancyRuntimeHours,
  classifyUnoccupiedEnergyShare,
  classifyUnoccupiedLoadRatio,
  SEVERITY_THRESHOLDS,
} from './severityClassification';

describe('severity classification', () => {
  it('centralizes threshold configuration for all diagnostics', () => {
    expect(SEVERITY_THRESHOLDS).toEqual({
      unoccupiedEnergyShare: {
        moderateMin: 5,
        highAbove: 15,
      },
      postOccupancyRuntimeHours: {
        moderateMin: 1,
        highAbove: 2,
      },
      closedDayEnergyShare: {
        moderateMin: 3,
        highAbove: 10,
      },
      unoccupiedLoadRatio: {
        moderateMin: 20,
        highAbove: 50,
      },
    });
  });

  it('classifies unoccupied energy share boundary values', () => {
    expect(classifyUnoccupiedEnergyShare(4.99)).toBe('low');
    expect(classifyUnoccupiedEnergyShare(5)).toBe('moderate');
    expect(classifyUnoccupiedEnergyShare(15)).toBe('moderate');
    expect(classifyUnoccupiedEnergyShare(15.01)).toBe('high');
  });

  it('classifies post-occupancy runtime boundary values', () => {
    expect(classifyPostOccupancyRuntimeHours(0.99)).toBe('low');
    expect(classifyPostOccupancyRuntimeHours(1)).toBe('moderate');
    expect(classifyPostOccupancyRuntimeHours(2)).toBe('moderate');
    expect(classifyPostOccupancyRuntimeHours(2.01)).toBe('high');
  });

  it('classifies closed-day energy share boundary values', () => {
    expect(classifyClosedDayEnergyShare(2.99)).toBe('low');
    expect(classifyClosedDayEnergyShare(3)).toBe('moderate');
    expect(classifyClosedDayEnergyShare(10)).toBe('moderate');
    expect(classifyClosedDayEnergyShare(10.01)).toBe('high');
  });

  it('classifies unoccupied load ratio boundary values', () => {
    expect(classifyUnoccupiedLoadRatio(19.99)).toBe('low');
    expect(classifyUnoccupiedLoadRatio(20)).toBe('moderate');
    expect(classifyUnoccupiedLoadRatio(50)).toBe('moderate');
    expect(classifyUnoccupiedLoadRatio(50.01)).toBe('high');
  });
});
