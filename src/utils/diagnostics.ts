import { HvacEnergyInterval, HvacEnergySummary } from './hvacEnergy';
import {
  calculateDailyHvacActivityThreshold,
  isSignificantHvacActivity,
} from './hvacActivity';
import { OperatingDay } from '../types/buildingConfig';

export type DiagnosticSeverity = 'Low' | 'Moderate' | 'High';

export const MVP_SEVERITY_THRESHOLDS = {
  closedDayEnergyShare: {
    moderateMinimumPercent: 3,
    highMinimumPercent: 10,
  },
  unoccupiedLoadRatio: {
    moderateMinimumPercent: 20,
    highMinimumPercent: 50,
  },
  postOccupancyRuntimeHours: {
    moderateMinimumHours: 1,
    highMinimumHours: 2,
  },
} as const;

export type UnoccupiedEnergyDiagnosticResult = {
  unoccupiedEnergyKwh: number;
  unoccupiedEnergyShare: number;
  unoccupiedCost: number;
};

export type StartupShutdownDiagnosticResult = {
  averagePreOccupancyRuntimeHours: number;
  averagePostOccupancyRuntimeHours: number;
  postOccupancySeverity: DiagnosticSeverity;
  analyzedDayCount: number;
};

export type ClosedDayActivityDiagnosticResult = {
  closedDays: OperatingDay[];
  closedDayEnergyKwh: number;
  closedDayEnergyShare: number;
  severity: DiagnosticSeverity;
};

export type UnoccupiedLoadRatioDiagnosticResult = {
  averageOccupiedDemandKw: number;
  averageUnoccupiedDemandKw: number;
  unoccupiedLoadRatio: number;
  severity: DiagnosticSeverity;
  occupiedRecordCount: number;
  unoccupiedRecordCount: number;
};

type DailyRecords = {
  dayKey: string;
  records: HvacEnergyInterval[];
};

const weekdayNames: OperatingDay[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const safeShare = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

const getLocalDayKey = (timestamp: Date) => {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const groupRecordsByLocalDay = (records: HvacEnergyInterval[]) => {
  const dayMap = new Map<string, HvacEnergyInterval[]>();

  records.forEach((record) => {
    const dayKey = getLocalDayKey(record.timestamp);
    const dayRecords = dayMap.get(dayKey) ?? [];
    dayRecords.push(record);
    dayMap.set(dayKey, dayRecords);
  });

  return [...dayMap.entries()].map(
    ([dayKey, records]): DailyRecords => ({
      dayKey,
      records: [...records].sort((left, right) => left.timestampMs - right.timestampMs),
    }),
  );
};

const classifyPostOccupancyRuntime = (runtimeHours: number): DiagnosticSeverity => {
  if (runtimeHours < MVP_SEVERITY_THRESHOLDS.postOccupancyRuntimeHours.moderateMinimumHours) {
    return 'Low';
  }

  if (runtimeHours <= MVP_SEVERITY_THRESHOLDS.postOccupancyRuntimeHours.highMinimumHours) {
    return 'Moderate';
  }

  return 'High';
};

const classifyPercentSeverity = (
  percent: number,
  thresholds: {
    moderateMinimumPercent: number;
    highMinimumPercent: number;
  },
): DiagnosticSeverity => {
  if (percent < thresholds.moderateMinimumPercent) {
    return 'Low';
  }

  if (percent <= thresholds.highMinimumPercent) {
    return 'Moderate';
  }

  return 'High';
};

const getLocalWeekday = (timestamp: Date): OperatingDay => weekdayNames[timestamp.getDay()];

const averageDemand = (records: HvacEnergyInterval[]) =>
  records.length > 0
    ? records.reduce((total, record) => total + record.hvacKw, 0) / records.length
    : 0;

export const analyzeUnoccupiedEnergy = (
  energySummary: HvacEnergySummary,
): UnoccupiedEnergyDiagnosticResult => ({
  unoccupiedEnergyKwh: energySummary.unoccupiedHvacEnergyKwh,
  unoccupiedEnergyShare: safeShare(
    energySummary.unoccupiedHvacEnergyKwh,
    energySummary.totalHvacEnergyKwh,
  ),
  unoccupiedCost: energySummary.unoccupiedElectricityCost,
});

export const analyzeClosedDayActivity = (
  energySummary: HvacEnergySummary,
  normalOperatingDays: OperatingDay[],
): ClosedDayActivityDiagnosticResult => {
  const operatingDaySet = new Set(normalOperatingDays);
  const closedDays = weekdayNames.filter((day) => !operatingDaySet.has(day));
  const closedDaySet = new Set(closedDays);
  const closedDayEnergyKwh = energySummary.intervals
    .filter((record) => closedDaySet.has(getLocalWeekday(record.timestamp)))
    .reduce((total, record) => total + record.intervalHvacEnergyKwh, 0);
  const closedDayEnergyShare = safeShare(
    closedDayEnergyKwh,
    energySummary.totalHvacEnergyKwh,
  );

  return {
    closedDays,
    closedDayEnergyKwh,
    closedDayEnergyShare,
    severity: classifyPercentSeverity(
      closedDayEnergyShare,
      MVP_SEVERITY_THRESHOLDS.closedDayEnergyShare,
    ),
  };
};

export const analyzeUnoccupiedLoadRatio = (
  energySummary: HvacEnergySummary,
): UnoccupiedLoadRatioDiagnosticResult => {
  const occupiedRecords = energySummary.intervals.filter((record) => record.occupied);
  const unoccupiedRecords = energySummary.intervals.filter((record) => !record.occupied);
  const averageOccupiedDemandKw = averageDemand(occupiedRecords);
  const averageUnoccupiedDemandKw = averageDemand(unoccupiedRecords);
  const unoccupiedLoadRatio = safeShare(
    averageUnoccupiedDemandKw,
    averageOccupiedDemandKw,
  );

  return {
    averageOccupiedDemandKw,
    averageUnoccupiedDemandKw,
    unoccupiedLoadRatio,
    severity: classifyPercentSeverity(
      unoccupiedLoadRatio,
      MVP_SEVERITY_THRESHOLDS.unoccupiedLoadRatio,
    ),
    occupiedRecordCount: occupiedRecords.length,
    unoccupiedRecordCount: unoccupiedRecords.length,
  };
};

export const analyzeStartupShutdown = (
  energySummary: HvacEnergySummary,
): StartupShutdownDiagnosticResult => {
  const dailyRuntimes = groupRecordsByLocalDay(energySummary.intervals).flatMap(({ records }) => {
    const occupiedRecords = records.filter((record) => record.occupied);

    if (occupiedRecords.length === 0) {
      return [];
    }

    const { dailyMaximumHvacDemandKw, dailySignificantActivityThresholdKw } =
      calculateDailyHvacActivityThreshold(records);
    const significantRecords = records.filter((record) =>
      isSignificantHvacActivity(record, dailySignificantActivityThresholdKw),
    );

    if (dailyMaximumHvacDemandKw <= 0 || significantRecords.length === 0) {
      return [];
    }

    const occupancyStartMs = occupiedRecords[0].timestampMs;
    const occupancyEndMs = occupiedRecords[occupiedRecords.length - 1].intervalEndMs;
    const significantBeforeOrDuringOccupancy = significantRecords.filter(
      (record) => record.timestampMs <= occupancyStartMs,
    );
    const significantDuringOrAfterOccupancy = significantRecords.filter(
      (record) => record.intervalEndMs >= occupancyEndMs,
    );
    const firstSignificantRecord =
      significantBeforeOrDuringOccupancy[0] ?? significantRecords[0];
    const lastSignificantRecord =
      significantDuringOrAfterOccupancy[significantDuringOrAfterOccupancy.length - 1] ??
      significantRecords[significantRecords.length - 1];

    const preOccupancyRuntimeHours = Math.max(
      0,
      (occupancyStartMs - firstSignificantRecord.timestampMs) / 3_600_000,
    );
    const postOccupancyRuntimeHours = Math.max(
      0,
      (lastSignificantRecord.intervalEndMs - occupancyEndMs) / 3_600_000,
    );

    return [{ preOccupancyRuntimeHours, postOccupancyRuntimeHours }];
  });

  const analyzedDayCount = dailyRuntimes.length;
  const averagePreOccupancyRuntimeHours =
    analyzedDayCount > 0
      ? dailyRuntimes.reduce((total, runtime) => total + runtime.preOccupancyRuntimeHours, 0) /
        analyzedDayCount
      : 0;
  const averagePostOccupancyRuntimeHours =
    analyzedDayCount > 0
      ? dailyRuntimes.reduce((total, runtime) => total + runtime.postOccupancyRuntimeHours, 0) /
        analyzedDayCount
      : 0;

  return {
    averagePreOccupancyRuntimeHours,
    averagePostOccupancyRuntimeHours,
    postOccupancySeverity: classifyPostOccupancyRuntime(averagePostOccupancyRuntimeHours),
    analyzedDayCount,
  };
};
