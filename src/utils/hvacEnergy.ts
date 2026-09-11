import { HvacCsvRecord } from '../types/csvUpload';

export type HvacEnergyInterval = HvacCsvRecord & {
  intervalHvacEnergyKwh: number;
};

export type HvacEnergySummary = {
  intervals: HvacEnergyInterval[];
  totalHvacEnergyKwh: number;
  occupiedHvacEnergyKwh: number;
  unoccupiedHvacEnergyKwh: number;
  electricityCost: number;
  occupiedElectricityCost: number;
  unoccupiedElectricityCost: number;
};

export const calculateIntervalHvacEnergyKwh = (hvacKw: number, intervalHours: number) =>
  hvacKw * intervalHours;

export const calculateElectricityCost = (energyKwh: number, electricityRate: number) =>
  energyKwh * electricityRate;

export const calculateHvacEnergySummary = (
  records: HvacCsvRecord[],
  electricityRate: number,
): HvacEnergySummary => {
  const intervals = records.map((record) => ({
    ...record,
    intervalHvacEnergyKwh: calculateIntervalHvacEnergyKwh(record.hvacKw, record.intervalHours),
  }));

  const occupiedHvacEnergyKwh = intervals
    .filter((record) => record.occupied)
    .reduce((total, record) => total + record.intervalHvacEnergyKwh, 0);

  const unoccupiedHvacEnergyKwh = intervals
    .filter((record) => !record.occupied)
    .reduce((total, record) => total + record.intervalHvacEnergyKwh, 0);

  const totalHvacEnergyKwh = occupiedHvacEnergyKwh + unoccupiedHvacEnergyKwh;

  return {
    intervals,
    totalHvacEnergyKwh,
    occupiedHvacEnergyKwh,
    unoccupiedHvacEnergyKwh,
    electricityCost: calculateElectricityCost(totalHvacEnergyKwh, electricityRate),
    occupiedElectricityCost: calculateElectricityCost(occupiedHvacEnergyKwh, electricityRate),
    unoccupiedElectricityCost: calculateElectricityCost(unoccupiedHvacEnergyKwh, electricityRate),
  };
};
