import {
  CsvColumn,
  CsvParseIssue,
  CsvParseResult,
  CsvUploadFile,
  HvacCsvRecord,
} from '../types/csvUpload';

const requiredColumns = ['timestamp', 'occupied', 'hvac_kw'] as const satisfies readonly CsvColumn[];
const optionalTemperatureColumns = ['indoor_temp_f', 'outdoor_temp_f'] as const satisfies readonly CsvColumn[];
const minimumDatasetHours = 24;
const intervalVarianceTolerance = 0.1;

type HeaderIndex = Partial<Record<CsvColumn, number>>;
type ParsedHvacCsvRecord = Omit<
  HvacCsvRecord,
  'intervalEnd' | 'intervalEndMs' | 'intervalMs' | 'intervalHours' | 'intervalSource' | 'hvacKwh'
>;

const normalizeHeader = (header: string) =>
  header.replace(/^\uFEFF/, '').trim().toLowerCase();

const parseCsvCells = (csvText: string) => {
  const rows: string[][] = [];
  const errors: CsvParseIssue[] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      if (cell.length === 0) {
        inQuotes = true;
      } else {
        errors.push({ message: 'Malformed CSV: unexpected quote in unquoted value.' });
      }
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char === '\r') {
      if (nextChar === '\n') {
        continue;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    errors.push({ message: 'Malformed CSV: quoted value was not closed.' });
  }

  if (cell.length > 0 || row.length > 0 || csvText.endsWith(',')) {
    row.push(cell);
    rows.push(row);
  }

  return { rows, errors };
};

const parseTimestamp = (rawValue: string) => {
  const value = rawValue.trim();
  const localDateMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (localDateMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = localDateMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );

    const isValidLocalDate =
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day) &&
      date.getHours() === Number(hour) &&
      date.getMinutes() === Number(minute) &&
      date.getSeconds() === Number(second);

    return isValidLocalDate ? date : null;
  }

  const parsedMs = Date.parse(value);
  return Number.isNaN(parsedMs) ? null : new Date(parsedMs);
};

const parseBoolean = (rawValue: string) => {
  const value = rawValue.trim().toLowerCase();
  const truthy = new Set(['true', 't', 'yes', 'y', '1', 'occupied']);
  const falsy = new Set(['false', 'f', 'no', 'n', '0', 'unoccupied']);

  if (truthy.has(value)) {
    return true;
  }

  if (falsy.has(value)) {
    return false;
  }

  return null;
};

const parseNumber = (rawValue: string) => {
  const value = rawValue.trim();

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDuration = (durationMs: number) => {
  const minutes = durationMs / 60000;

  if (minutes < 60) {
    return `${Number(minutes.toFixed(2))} minutes`;
  }

  const hours = minutes / 60;
  return `${Number(hours.toFixed(2))} hours`;
};

const getMedianIntervalMs = (intervals: number[]) => {
  const sortedIntervals = [...intervals].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedIntervals.length / 2);

  return sortedIntervals.length % 2 === 0
    ? (sortedIntervals[middleIndex - 1] + sortedIntervals[middleIndex]) / 2
    : sortedIntervals[middleIndex];
};

const getCell = (row: string[], headerIndex: HeaderIndex, column: CsvColumn) => {
  const columnIndex = headerIndex[column];
  return columnIndex === undefined ? undefined : row[columnIndex];
};

const buildHeaderIndex = (headerRow: string[]) => {
  const headerIndex: HeaderIndex = {};
  const errors: CsvParseIssue[] = [];
  const seenHeaders = new Set<string>();

  headerRow.forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (!normalizedHeader) {
      return;
    }

    if (seenHeaders.has(normalizedHeader)) {
      errors.push({ message: `Duplicate column header: ${normalizedHeader}` });
      return;
    }

    seenHeaders.add(normalizedHeader);

    if ([...requiredColumns, ...optionalTemperatureColumns].includes(normalizedHeader as CsvColumn)) {
      headerIndex[normalizedHeader as CsvColumn] = index;
    }
  });

  requiredColumns.forEach((column) => {
    if (headerIndex[column] === undefined) {
      errors.push({ field: column, message: `Missing required column: ${column}` });
    }
  });

  return { headerIndex, errors };
};

export const parseCsvText = (csvText: string): CsvParseResult => {
  const trimmedText = csvText.trim();

  if (!trimmedText) {
    return {
      records: [],
      errors: [{ message: 'CSV file is empty.' }],
      warnings: [],
    };
  }

  const { rows, errors } = parseCsvCells(trimmedText);

  if (rows.length === 0) {
    return {
      records: [],
      errors: [{ message: 'CSV file is empty.' }, ...errors],
      warnings: [],
    };
  }

  const [headerRow, ...dataRows] = rows;
  const { headerIndex, errors: headerErrors } = buildHeaderIndex(headerRow);
  const parseErrors = [...errors, ...headerErrors];
  const warnings: CsvParseIssue[] = [];

  if (headerErrors.length > 0) {
    return {
      records: [],
      errors: parseErrors,
      warnings,
    };
  }

  const parsedRecords: ParsedHvacCsvRecord[] = [];

  dataRows.forEach((row, rowIndex) => {
    const sourceRow = rowIndex + 2;

    if (row.every((cell) => !cell.trim())) {
      return;
    }

    const timestampValue = getCell(row, headerIndex, 'timestamp')?.trim() ?? '';
    const occupiedValue = getCell(row, headerIndex, 'occupied')?.trim() ?? '';
    const hvacKwValue = getCell(row, headerIndex, 'hvac_kw')?.trim() ?? '';

    const rowErrors: CsvParseIssue[] = [];

    if (!timestampValue) {
      rowErrors.push({ row: sourceRow, field: 'timestamp', message: 'Missing timestamp.' });
    }

    if (!occupiedValue) {
      rowErrors.push({ row: sourceRow, field: 'occupied', message: 'Missing occupied value.' });
    }

    if (!hvacKwValue) {
      rowErrors.push({ row: sourceRow, field: 'hvac_kw', message: 'Missing hvac_kw value.' });
    }

    const timestamp = timestampValue ? parseTimestamp(timestampValue) : null;
    const occupied = occupiedValue ? parseBoolean(occupiedValue) : null;
    const hvacKw = hvacKwValue ? parseNumber(hvacKwValue) : null;
    const indoorTempValue = getCell(row, headerIndex, 'indoor_temp_f')?.trim() ?? '';
    const outdoorTempValue = getCell(row, headerIndex, 'outdoor_temp_f')?.trim() ?? '';
    const indoorTempF = indoorTempValue ? parseNumber(indoorTempValue) : undefined;
    const outdoorTempF = outdoorTempValue ? parseNumber(outdoorTempValue) : undefined;

    if (timestampValue && !timestamp) {
      rowErrors.push({ row: sourceRow, field: 'timestamp', message: 'Invalid timestamp.' });
    }

    if (occupiedValue && occupied === null) {
      rowErrors.push({ row: sourceRow, field: 'occupied', message: 'Invalid occupied boolean.' });
    }

    if (hvacKwValue && hvacKw === null) {
      rowErrors.push({ row: sourceRow, field: 'hvac_kw', message: 'Invalid numeric hvac_kw value.' });
    } else if (hvacKw !== null && hvacKw < 0) {
      rowErrors.push({ row: sourceRow, field: 'hvac_kw', message: 'hvac_kw cannot be negative.' });
    }

    if (indoorTempValue && indoorTempF === null) {
      rowErrors.push({ row: sourceRow, field: 'indoor_temp_f', message: 'Invalid indoor_temp_f value.' });
    }

    if (outdoorTempValue && outdoorTempF === null) {
      rowErrors.push({ row: sourceRow, field: 'outdoor_temp_f', message: 'Invalid outdoor_temp_f value.' });
    }

    if (rowErrors.length > 0) {
      parseErrors.push(...rowErrors);
      return;
    }

    if (!timestamp || occupied === null || hvacKw === null) {
      parseErrors.push({ row: sourceRow, message: 'Unable to normalize CSV row.' });
      return;
    }

    parsedRecords.push({
      sourceRow,
      timestamp,
      timestampMs: timestamp.getTime(),
      occupied,
      hvacKw,
      ...(typeof indoorTempF === 'number' ? { indoorTempF } : {}),
      ...(typeof outdoorTempF === 'number' ? { outdoorTempF } : {}),
    });
  });

  parsedRecords.sort((left, right) => left.timestampMs - right.timestampMs);

  const uniqueRecords: ParsedHvacCsvRecord[] = [];
  const duplicateRows: number[] = [];
  const seenTimestamps = new Set<number>();

  parsedRecords.forEach((record) => {
    if (seenTimestamps.has(record.timestampMs)) {
      duplicateRows.push(record.sourceRow);
      return;
    }

    seenTimestamps.add(record.timestampMs);
    uniqueRecords.push(record);
  });

  if (duplicateRows.length > 0) {
    warnings.push({
      field: 'timestamp',
      message: `${duplicateRows.length} duplicate timestamp${
        duplicateRows.length === 1 ? ' was' : 's were'
      } ignored after sorting. Keep one row per timestamp before analysis. Rows: ${duplicateRows
        .slice(0, 8)
        .join(', ')}${duplicateRows.length > 8 ? ', ...' : ''}.`,
    });
  }

  if (uniqueRecords.length < 2 && parseErrors.length === 0) {
    parseErrors.push({ message: 'CSV must contain at least two valid data rows.' });
  }

  const observedIntervalsMs = uniqueRecords
    .slice(0, -1)
    .map((record, index) => uniqueRecords[index + 1].timestampMs - record.timestampMs);

  const invalidIntervalIndex = observedIntervalsMs.findIndex((intervalMs) => intervalMs <= 0);

  if (invalidIntervalIndex >= 0 && parseErrors.length === 0) {
    parseErrors.push({
      row: uniqueRecords[invalidIntervalIndex + 1]?.sourceRow,
      field: 'timestamp',
      message: 'Timestamps must increase after duplicate rows are removed.',
    });
  }

  const typicalIntervalMs =
    observedIntervalsMs.length > 0 && invalidIntervalIndex < 0
      ? getMedianIntervalMs(observedIntervalsMs)
      : 0;

  if (typicalIntervalMs <= 0 && parseErrors.length === 0) {
    parseErrors.push({
      field: 'timestamp',
      message: 'Unable to calculate a positive measurement interval from timestamps.',
    });
  }

  if (typicalIntervalMs > 0) {
    const irregularIntervals = observedIntervalsMs.filter(
      (intervalMs) =>
        Math.abs(intervalMs - typicalIntervalMs) / typicalIntervalMs > intervalVarianceTolerance,
    );

    if (irregularIntervals.length > 0) {
      warnings.push({
        field: 'timestamp',
        message: `${irregularIntervals.length} irregular interval${
          irregularIntervals.length === 1 ? '' : 's'
        } detected. Typical interval is ${formatDuration(typicalIntervalMs)}; analytics will use each actual interval duration.`,
      });
    }
  }

  const records: HvacCsvRecord[] =
    parseErrors.length === 0 && typicalIntervalMs > 0
      ? uniqueRecords.map((record, index) => {
          const nextRecord = uniqueRecords[index + 1];
          const intervalMs = nextRecord
            ? nextRecord.timestampMs - record.timestampMs
            : typicalIntervalMs;
          const intervalEndMs = record.timestampMs + intervalMs;
          const intervalHours = intervalMs / 3600000;

          return {
            ...record,
            intervalEnd: new Date(intervalEndMs),
            intervalEndMs,
            intervalMs,
            intervalHours,
            intervalSource: nextRecord ? 'next-record' : 'typical-final-record',
            hvacKwh: record.hvacKw * intervalHours,
          };
        })
      : [];

  if (records.length > 0) {
    const datasetDurationHours =
      (records[records.length - 1].intervalEndMs - records[0].timestampMs) / 3600000;

    if (datasetDurationHours < minimumDatasetHours && parseErrors.length === 0) {
      parseErrors.push({
        field: 'timestamp',
        message: `CSV must contain at least ${minimumDatasetHours} hours of valid observations. Current dataset covers ${Number(
          datasetDurationHours.toFixed(2),
        )} hours.`,
      });
    }
  }

  return {
    records: parseErrors.length > 0 ? [] : records,
    errors: parseErrors,
    warnings,
  };
};

export const parseCsvFile = async (file: CsvUploadFile) => parseCsvText(await file.text());
