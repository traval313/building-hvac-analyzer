import { describe, expect, it } from 'vitest';

import {
  classifyOverallReview,
  OVERALL_CLASSIFICATION_CONTENT,
} from './overallClassification';

describe('overall classification', () => {
  it('returns priority review suggested when any diagnostic is high', () => {
    expect(classifyOverallReview(['low', 'moderate', 'high', 'low'])).toBe(
      'priority-review-suggested',
    );
  });

  it('returns review suggested when no diagnostics are high but at least one is moderate', () => {
    expect(classifyOverallReview(['low', 'moderate', 'low', 'low'])).toBe(
      'review-suggested',
    );
  });

  it('returns low concern when all available diagnostics are low', () => {
    expect(classifyOverallReview(['low', 'low', 'low', 'low'])).toBe('low-concern');
  });

  it('exposes concise dashboard copy for each classification', () => {
    expect(OVERALL_CLASSIFICATION_CONTENT).toEqual({
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
    });
  });
});
