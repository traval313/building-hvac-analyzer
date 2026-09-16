import { BuildingConfig } from '../types/buildingConfig';
import afterHoursIssueCsv from '../../sample-data/after-hours-issue.csv?raw';
import efficientBuildingCsv from '../../sample-data/efficient-building.csv?raw';
import weekendIssueCsv from '../../sample-data/weekend-issue.csv?raw';

export type SampleDatasetId =
  | 'efficient-building'
  | 'after-hours-issue'
  | 'weekend-issue';

export type SampleDataset = {
  id: SampleDatasetId;
  label: string;
  fileName: string;
  description: string;
  csvText: string;
  buildingConfig: BuildingConfig;
};

const sampleBuildingConfig = (buildingName: string): BuildingConfig => ({
  buildingName,
  buildingType: 'Office',
  electricityRate: 0.15,
  normalOperatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
});

export const sampleDatasets: SampleDataset[] = [
  {
    id: 'efficient-building',
    label: 'Efficient Building',
    fileName: 'efficient-building.csv',
    description: 'HVAC operation generally aligns with weekday occupancy.',
    csvText: efficientBuildingCsv,
    buildingConfig: sampleBuildingConfig('Efficient Building Demo'),
  },
  {
    id: 'after-hours-issue',
    label: 'After-Hours Issue',
    fileName: 'after-hours-issue.csv',
    description: 'Demonstrates elevated HVAC activity outside occupied hours.',
    csvText: afterHoursIssueCsv,
    buildingConfig: sampleBuildingConfig('After-Hours Issue Demo'),
  },
  {
    id: 'weekend-issue',
    label: 'Weekend Issue',
    fileName: 'weekend-issue.csv',
    description: 'Demonstrates HVAC activity on configured closed days.',
    csvText: weekendIssueCsv,
    buildingConfig: sampleBuildingConfig('Weekend Issue Demo'),
  },
];
