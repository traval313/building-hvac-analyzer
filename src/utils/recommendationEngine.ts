import {
  ClosedDayActivityDiagnosticResult,
  StartupShutdownDiagnosticResult,
  UnoccupiedEnergyDiagnosticResult,
  UnoccupiedLoadRatioDiagnosticResult,
} from './diagnostics';
import { Severity } from './severityClassification';

export type RecommendationDiagnosticId =
  | 'unoccupied-energy'
  | 'post-occupancy-runtime'
  | 'closed-day-activity'
  | 'unoccupied-load-ratio';

export type RecommendationActionType =
  | 'review'
  | 'investigate'
  | 'verify'
  | 'monitor'
  | 'informational';

export type DiagnosticRecommendationsInput = {
  unoccupiedEnergy: UnoccupiedEnergyDiagnosticResult;
  startupShutdown: StartupShutdownDiagnosticResult;
  closedDayActivity: ClosedDayActivityDiagnosticResult;
  unoccupiedLoadRatio: UnoccupiedLoadRatioDiagnosticResult;
};

export type DiagnosticRecommendation = {
  id: RecommendationDiagnosticId;
  diagnosticNumber: 1 | 2 | 3 | 4;
  diagnosticName: string;
  severity: Severity;
  actionType: RecommendationActionType;
  title: string;
  description: string;
};

type RecommendationTemplate = Omit<
  DiagnosticRecommendation,
  'severity' | 'actionType' | 'title' | 'description'
> & {
  recommendations: Record<
    Severity,
    Pick<DiagnosticRecommendation, 'actionType' | 'title' | 'description'>
  >;
};

const severityOrder: Record<Severity, number> = {
  high: 0,
  moderate: 1,
  low: 2,
};

const recommendationTemplates = [
  {
    id: 'unoccupied-energy',
    diagnosticNumber: 1,
    diagnosticName: 'Unoccupied HVAC Energy',
    recommendations: {
      high: {
        actionType: 'review',
        title: 'Review unoccupied HVAC operating context',
        description:
          'Review HVAC schedules, occupancy overrides, and legitimate after-hours requirements that may explain the high unoccupied energy finding.',
      },
      moderate: {
        actionType: 'monitor',
        title: 'Monitor unoccupied HVAC energy drivers',
        description:
          'Monitor HVAC schedules, occupancy overrides, and recurring after-hours requirements to determine whether the moderate unoccupied energy finding needs deeper review.',
      },
      low: {
        actionType: 'informational',
        title: 'Unoccupied HVAC energy appears limited',
        description:
          'No action recommendation is raised for this finding; keep using schedule and occupancy reviews during normal operational checks.',
      },
    },
  },
  {
    id: 'post-occupancy-runtime',
    diagnosticNumber: 2,
    diagnosticName: 'Startup & Shutdown',
    recommendations: {
      high: {
        actionType: 'investigate',
        title: 'Investigate evening runtime context',
        description:
          'Investigate evening shutdown schedules and whether documented after-hours occupancy explains the extended post-occupancy runtime.',
      },
      moderate: {
        actionType: 'monitor',
        title: 'Monitor post-occupancy runtime',
        description:
          'Monitor evening shutdown timing and after-hours occupancy notes to see whether the moderate post-occupancy runtime pattern persists.',
      },
      low: {
        actionType: 'informational',
        title: 'Post-occupancy runtime appears limited',
        description:
          'No action recommendation is raised for this finding; continue comparing shutdown timing against normal operating expectations.',
      },
    },
  },
  {
    id: 'closed-day-activity',
    diagnosticNumber: 3,
    diagnosticName: 'Closed-Day Activity',
    recommendations: {
      high: {
        actionType: 'verify',
        title: 'Verify closed-day operating context',
        description:
          'Verify weekend or closed-day schedules, special events, maintenance periods, and manual overrides that may explain the high closed-day activity finding.',
      },
      moderate: {
        actionType: 'monitor',
        title: 'Monitor closed-day HVAC activity',
        description:
          'Monitor weekend or closed-day schedules, special events, maintenance periods, and manual overrides to understand the moderate closed-day activity finding.',
      },
      low: {
        actionType: 'informational',
        title: 'Closed-day activity appears limited',
        description:
          'No action recommendation is raised for this finding; keep validating closed-day calendars when operating schedules change.',
      },
    },
  },
  {
    id: 'unoccupied-load-ratio',
    diagnosticNumber: 4,
    diagnosticName: 'Unoccupied Load Ratio',
    recommendations: {
      high: {
        actionType: 'investigate',
        title: 'Investigate unoccupied load drivers',
        description:
          'Investigate setbacks, ventilation requirements, overrides, and controls or equipment operation during unoccupied periods that may explain the high load ratio.',
      },
      moderate: {
        actionType: 'monitor',
        title: 'Monitor unoccupied load ratio',
        description:
          'Monitor setbacks, ventilation requirements, overrides, and controls or equipment operation during unoccupied periods to understand the moderate load ratio.',
      },
      low: {
        actionType: 'informational',
        title: 'Unoccupied load ratio appears limited',
        description:
          'No action recommendation is raised for this finding; continue checking unoccupied operation as part of routine controls review.',
      },
    },
  },
] as const satisfies readonly RecommendationTemplate[];

const buildRecommendation = (
  template: RecommendationTemplate,
  severity: Severity,
): DiagnosticRecommendation => {
  const recommendation = template.recommendations[severity];

  return {
    id: template.id,
    diagnosticNumber: template.diagnosticNumber,
    diagnosticName: template.diagnosticName,
    severity,
    ...recommendation,
  };
};

export const getDiagnosticRecommendations = (
  diagnostics: DiagnosticRecommendationsInput,
): DiagnosticRecommendation[] => {
  const severities: Record<RecommendationDiagnosticId, Severity> = {
    'unoccupied-energy': diagnostics.unoccupiedEnergy.severity,
    'post-occupancy-runtime': diagnostics.startupShutdown.postOccupancySeverity,
    'closed-day-activity': diagnostics.closedDayActivity.severity,
    'unoccupied-load-ratio': diagnostics.unoccupiedLoadRatio.severity,
  };

  return recommendationTemplates
    .map((template) => buildRecommendation(template, severities[template.id]))
    .sort((left, right) => {
      const severityComparison = severityOrder[left.severity] - severityOrder[right.severity];

      return severityComparison === 0
        ? left.diagnosticNumber - right.diagnosticNumber
        : severityComparison;
    });
};
