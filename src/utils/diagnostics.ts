import { HvacEnergyInterval, HvacEnergySummary } from './hvacEnergy';

export type DiagnosticSeverity = 'Low' | 'Moderate' | 'High';

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

type DailyRecords = {
  dayKey: string;
  records: HvacEnergyInterval[];
};

const significantActivityThresholdRatio = 0.1;

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
  if (runtimeHours < 1) {
    return 'Low';
  }

  if (runtimeHours <= 2) {
    return 'Moderate';
  }

  return 'High';
};

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

export const analyzeStartupShutdown = (
  energySummary: HvacEnergySummary,
): StartupShutdownDiagnosticResult => {
  const dailyRuntimes = groupRecordsByLocalDay(energySummary.intervals).flatMap(({ records }) => {
    const occupiedRecords = records.filter((record) => record.occupied);

    if (occupiedRecords.length === 0) {
      return [];
    }

    const maxHvacKw = Math.max(...records.map((record) => record.hvacKw));
    const significantThresholdKw = maxHvacKw * significantActivityThresholdRatio;
    const significantRecords = records.filter((record) => record.hvacKw >= significantThresholdKw);

    if (maxHvacKw <= 0 || significantRecords.length === 0) {
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
