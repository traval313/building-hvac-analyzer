export type Severity = 'low' | 'moderate' | 'high';

type SeverityThreshold = {
  moderateMin: number;
  highAbove: number;
};

export const SEVERITY_THRESHOLDS = {
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
} as const satisfies Record<string, SeverityThreshold>;

const classifySeverity = (value: number, thresholds: SeverityThreshold): Severity => {
  if (value < thresholds.moderateMin) {
    return 'low';
  }

  if (value <= thresholds.highAbove) {
    return 'moderate';
  }

  return 'high';
};

export const classifyUnoccupiedEnergyShare = (percent: number): Severity =>
  classifySeverity(percent, SEVERITY_THRESHOLDS.unoccupiedEnergyShare);

export const classifyPostOccupancyRuntimeHours = (runtimeHours: number): Severity =>
  classifySeverity(runtimeHours, SEVERITY_THRESHOLDS.postOccupancyRuntimeHours);

export const classifyClosedDayEnergyShare = (percent: number): Severity =>
  classifySeverity(percent, SEVERITY_THRESHOLDS.closedDayEnergyShare);

export const classifyUnoccupiedLoadRatio = (percent: number): Severity =>
  classifySeverity(percent, SEVERITY_THRESHOLDS.unoccupiedLoadRatio);
