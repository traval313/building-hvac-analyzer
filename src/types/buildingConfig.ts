export const buildingTypes = [
  'Office',
  'Retail',
  'School/Education',
  'Healthcare',
  'Warehouse',
  'Other',
] as const;

export type BuildingType = (typeof buildingTypes)[number];

export const operatingDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type OperatingDay = (typeof operatingDays)[number];

export type BuildingConfig = {
  buildingName: string;
  buildingType: BuildingType;
  electricityRate: number;
  normalOperatingDays: OperatingDay[];
};
