import { describe, expect, it } from 'vitest';

import recommendationFixtureCsv from '../../sample-data/buildingpulse_recommendations_high_findings.csv?raw';
import { parseCsvText } from './csvParser';
import {
  analyzeClosedDayActivity,
  analyzeStartupShutdown,
  analyzeUnoccupiedEnergy,
  analyzeUnoccupiedLoadRatio,
} from './diagnostics';
import { calculateHvacEnergySummary } from './hvacEnergy';
import {
  DiagnosticRecommendationsInput,
  getDiagnosticRecommendations,
} from './recommendationEngine';

const makeDiagnostics = (
  severities: {
    unoccupiedEnergy: DiagnosticRecommendationsInput['unoccupiedEnergy']['severity'];
    startupShutdown: DiagnosticRecommendationsInput['startupShutdown']['postOccupancySeverity'];
    closedDayActivity: DiagnosticRecommendationsInput['closedDayActivity']['severity'];
    unoccupiedLoadRatio: DiagnosticRecommendationsInput['unoccupiedLoadRatio']['severity'];
  },
): DiagnosticRecommendationsInput => ({
  unoccupiedEnergy: {
    unoccupiedEnergyKwh: 500,
    unoccupiedEnergyShare: 25,
    unoccupiedCost: 75,
    severity: severities.unoccupiedEnergy,
  },
  startupShutdown: {
    averagePreOccupancyRuntimeHours: 0.5,
    averagePostOccupancyRuntimeHours: 3,
    postOccupancySeverity: severities.startupShutdown,
    analyzedDayCount: 5,
  },
  closedDayActivity: {
    closedDays: ['Sunday', 'Saturday'],
    closedDayEnergyKwh: 100,
    closedDayEnergyShare: 12,
    severity: severities.closedDayActivity,
  },
  unoccupiedLoadRatio: {
    averageOccupiedDemandKw: 50,
    averageUnoccupiedDemandKw: 30,
    unoccupiedLoadRatio: 60,
    severity: severities.unoccupiedLoadRatio,
    occupiedRecordCount: 10,
    unoccupiedRecordCount: 14,
  },
});

describe('getDiagnosticRecommendations', () => {
  it('returns recommendations in deterministic severity and diagnostic order', () => {
    const recommendations = getDiagnosticRecommendations(
      makeDiagnostics({
        unoccupiedEnergy: 'moderate',
        startupShutdown: 'high',
        closedDayActivity: 'low',
        unoccupiedLoadRatio: 'high',
      }),
    );

    expect(recommendations.map((recommendation) => recommendation.id)).toEqual([
      'post-occupancy-runtime',
      'unoccupied-load-ratio',
      'unoccupied-energy',
      'closed-day-activity',
    ]);
    expect(recommendations.map((recommendation) => recommendation.severity)).toEqual([
      'high',
      'high',
      'moderate',
      'low',
    ]);
  });

  it('maps each high diagnostic to contextual review language without prescribing control changes', () => {
    const recommendations = getDiagnosticRecommendations(
      makeDiagnostics({
        unoccupiedEnergy: 'high',
        startupShutdown: 'high',
        closedDayActivity: 'high',
        unoccupiedLoadRatio: 'high',
      }),
    );

    expect(recommendations).toEqual([
      expect.objectContaining({
        id: 'unoccupied-energy',
        actionType: 'review',
        description: expect.stringContaining('HVAC schedules'),
      }),
      expect.objectContaining({
        id: 'post-occupancy-runtime',
        actionType: 'investigate',
        description: expect.stringContaining('after-hours occupancy'),
      }),
      expect.objectContaining({
        id: 'closed-day-activity',
        actionType: 'verify',
        description: expect.stringContaining('special events'),
      }),
      expect.objectContaining({
        id: 'unoccupied-load-ratio',
        actionType: 'investigate',
        description: expect.stringContaining('ventilation requirements'),
      }),
    ]);

    const recommendationText = recommendations
      .map((recommendation) => `${recommendation.title} ${recommendation.description}`)
      .join(' ')
      .toLowerCase();

    expect(recommendationText).not.toMatch(/\bwasteful\b/);
    expect(recommendationText).not.toMatch(/\bmust\b/);
    expect(recommendationText).not.toMatch(/\bshould change\b/);
    expect(recommendationText).not.toMatch(/\breduce setpoints\b/);
    expect(recommendationText).not.toMatch(/\bturn off\b/);
  });

  it('uses moderate monitor language and low informational language', () => {
    const recommendations = getDiagnosticRecommendations(
      makeDiagnostics({
        unoccupiedEnergy: 'low',
        startupShutdown: 'moderate',
        closedDayActivity: 'low',
        unoccupiedLoadRatio: 'moderate',
      }),
    );

    expect(
      recommendations
        .filter((recommendation) => recommendation.severity === 'moderate')
        .map((recommendation) => recommendation.actionType),
    ).toEqual(['monitor', 'monitor']);
    expect(
      recommendations
        .filter((recommendation) => recommendation.severity === 'low')
      .map((recommendation) => recommendation.actionType),
    ).toEqual(['informational', 'informational']);
  });

  it('generates high-priority recommendations from the generated CSV upload fixture', () => {
    const parseResult = parseCsvText(recommendationFixtureCsv);

    expect(parseResult.errors).toEqual([]);

    const energySummary = calculateHvacEnergySummary(parseResult.records, 0.18);
    const recommendations = getDiagnosticRecommendations({
      unoccupiedEnergy: analyzeUnoccupiedEnergy(energySummary),
      startupShutdown: analyzeStartupShutdown(energySummary),
      closedDayActivity: analyzeClosedDayActivity(energySummary, [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ]),
      unoccupiedLoadRatio: analyzeUnoccupiedLoadRatio(energySummary),
    });

    expect(recommendations.map((recommendation) => recommendation.id)).toEqual([
      'unoccupied-energy',
      'post-occupancy-runtime',
      'closed-day-activity',
      'unoccupied-load-ratio',
    ]);
    expect(recommendations.every((recommendation) => recommendation.severity === 'high')).toBe(
      true,
    );
  });
});
