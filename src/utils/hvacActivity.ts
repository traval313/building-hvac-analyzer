// Prototype assumption: this 10% threshold is not an industry performance standard.
export const HVAC_ACTIVITY_THRESHOLD = 0.10;

export type HvacActivityRecord = {
  hvacKw: number;
};

export type DailyHvacActivityThreshold = {
  dailyMaximumHvacDemandKw: number;
  dailySignificantActivityThresholdKw: number;
};

export const calculateDailyMaximumHvacDemand = <Record extends HvacActivityRecord>(
  records: Record[],
) => records.reduce((maximumDemand, record) => Math.max(maximumDemand, record.hvacKw), 0);

export const calculateDailySignificantActivityThreshold = (dailyMaximumHvacDemandKw: number) =>
  dailyMaximumHvacDemandKw * HVAC_ACTIVITY_THRESHOLD;

export const calculateDailyHvacActivityThreshold = <Record extends HvacActivityRecord>(
  records: Record[],
): DailyHvacActivityThreshold => {
  const dailyMaximumHvacDemandKw = calculateDailyMaximumHvacDemand(records);

  return {
    dailyMaximumHvacDemandKw,
    dailySignificantActivityThresholdKw:
      calculateDailySignificantActivityThreshold(dailyMaximumHvacDemandKw),
  };
};

export const isSignificantHvacActivity = (
  record: HvacActivityRecord,
  dailySignificantActivityThresholdKw: number,
) => record.hvacKw >= dailySignificantActivityThresholdKw;
