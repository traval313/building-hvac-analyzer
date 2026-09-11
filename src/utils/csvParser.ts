import {
  CsvColumn,
  CsvParseIssue,
  CsvParseResult,
  CsvUploadFile,
  HvacCsvRecord,
} from '../types/csvUpload';

const requiredColumns = ['timestamp', 'occupied', 'hvac_kw'] as const satisfies readonly CsvColumn[];
const optionalTemperatureColumns = ['indoor_temp_f', 'outdoor_temp_f'] as const satisfies readonly CsvColumn[];

type HeaderIndex = Partial<Record<CsvColumn, number>>;

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

  const records: HvacCsvRecord[] = [];
  const timestampCounts = new Map<number, number>();

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

    const timestampMs = timestamp.getTime();
    timestampCounts.set(timestampMs, (timestampCounts.get(timestampMs) ?? 0) + 1);

    records.push({
      sourceRow,
      timestamp,
      timestampMs,
      occupied,
      hvacKw,
      ...(typeof indoorTempF === 'number' ? { indoorTempF } : {}),
      ...(typeof outdoorTempF === 'number' ? { outdoorTempF } : {}),
    });
  });

  const duplicateTimestampCount = [...timestampCounts.values()].reduce(
    (count, timestampCount) => count + Math.max(0, timestampCount - 1),
    0,
  );

  if (duplicateTimestampCount > 0) {
    warnings.push({
      field: 'timestamp',
      message: `${duplicateTimestampCount} duplicate timestamp${
        duplicateTimestampCount === 1 ? '' : 's'
      } detected.`,
    });
  }

  records.sort((left, right) => left.timestampMs - right.timestampMs);

  if (records.length < 2 && parseErrors.length === 0) {
    parseErrors.push({ message: 'CSV must contain at least two valid data rows.' });
  }

  return {
    records: parseErrors.length > 0 ? [] : records,
    errors: parseErrors,
    warnings,
  };
};

export const parseCsvFile = async (file: CsvUploadFile) => parseCsvText(await file.text());
