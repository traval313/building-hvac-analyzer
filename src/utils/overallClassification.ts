import { Severity } from './severityClassification';

export type OverallClassification =
  | 'low-concern'
  | 'review-suggested'
  | 'priority-review-suggested';

export type OverallClassificationContent = {
  label: string;
  description: string;
};

export const OVERALL_CLASSIFICATION_CONTENT: Record<
  OverallClassification,
  OverallClassificationContent
> = {
  'low-concern': {
    label: 'Low concern',
    description:
      'No major operational patterns were identified by the available diagnostics.',
  },
  'review-suggested': {
    label: 'Review suggested',
    description: 'One or more patterns may warrant review.',
  },
  'priority-review-suggested': {
    label: 'Priority review suggested',
    description:
      'One or more higher-severity patterns warrant prioritized investigation.',
  },
};

export const classifyOverallReview = (
  diagnosticSeverities: Severity[],
): OverallClassification => {
  if (diagnosticSeverities.includes('high')) {
    return 'priority-review-suggested';
  }

  if (diagnosticSeverities.includes('moderate')) {
    return 'review-suggested';
  }

  return 'low-concern';
};
