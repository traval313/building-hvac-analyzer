export type CsvUploadFile = File;

export type CsvColumn =
  | 'timestamp'
  | 'occupied'
  | 'hvac_kw'
  | 'indoor_temp_f'
  | 'outdoor_temp_f';

export type HvacCsvRecord = {
  sourceRow: number;
  timestamp: Date;
  timestampMs: number;
  intervalEnd: Date;
  intervalEndMs: number;
  intervalMs: number;
  intervalHours: number;
  intervalSource: 'next-record' | 'typical-final-record';
  hvacKwh: number;
  occupied: boolean;
  hvacKw: number;
  indoorTempF?: number;
  outdoorTempF?: number;
};

export type CsvParseIssue = {
  row?: number;
  field?: CsvColumn;
  message: string;
};

export type CsvParseResult = {
  records: HvacCsvRecord[];
  errors: CsvParseIssue[];
  warnings: CsvParseIssue[];
};
