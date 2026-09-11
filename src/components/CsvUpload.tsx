import { ChangeEvent, useRef, useState } from 'react';
import { CsvParseIssue, CsvParseResult, CsvUploadFile } from '../types/csvUpload';
import { parseCsvFile } from '../utils/csvParser';

type CsvUploadProps = {
  selectedFile: CsvUploadFile | null;
  parseResult: CsvParseResult | null;
  onFileSelect: (file: CsvUploadFile, parseResult: CsvParseResult) => void;
  onFileRemove: () => void;
};

const csvMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

const isCsvFile = (file: File) => {
  const hasCsvName = file.name.toLowerCase().endsWith('.csv');
  const hasCsvType = file.type ? csvMimeTypes.has(file.type) : false;

  return hasCsvName || hasCsvType;
};

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const formatIssue = (issue: CsvParseIssue) => {
  const location = issue.row ? `Row ${issue.row}: ` : '';
  return `${location}${issue.message}`;
};

function CsvUpload({ selectedFile, parseResult, onFileSelect, onFileRemove }: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError('');

    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setError('Select a CSV file with a .csv extension.');
      resetInput();
      return;
    }

    setIsPreparing(true);

    try {
      const result = await parseCsvFile(file);

      if (result.errors.length > 0) {
        setError(result.errors.map(formatIssue).join(' '));
        resetInput();
        return;
      }

      onFileSelect(file, result);
    } catch {
      setError('Unable to read this CSV file.');
      resetInput();
    } finally {
      setIsPreparing(false);
    }
  };

  const handleRemove = () => {
    resetInput();
    setError('');
    setIsPreparing(false);
    onFileRemove();
  };

  const handleReplace = () => {
    inputRef.current?.click();
  };

  return (
    <div className="csv-upload">
      <label className="csv-picker" htmlFor="csvFile">
        <span className="csv-picker-title">Select local CSV file</span>
        <span className="csv-picker-subtitle">CSV contents stay in this browser.</span>
        <input
          accept=".csv,text/csv"
          aria-describedby={error ? 'csv-upload-error' : undefined}
          aria-invalid={Boolean(error)}
          disabled={isPreparing}
          id="csvFile"
          name="csvFile"
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
      </label>

      {isPreparing && (
        <div className="upload-status" aria-live="polite" role="status">
          Parsing CSV records...
        </div>
      )}

      {error && (
        <p className="field-error" id="csv-upload-error">
          {error}
        </p>
      )}

      {selectedFile && !isPreparing && (
        <div className="file-summary" aria-live="polite">
          <div>
            <p className="summary-label">Selected file</p>
            <h3>{selectedFile.name}</h3>
          </div>
          <dl>
            <div>
              <dt>Size</dt>
              <dd>{formatFileSize(selectedFile.size)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{selectedFile.type || 'Not provided'}</dd>
            </div>
            {parseResult && (
              <>
                <div>
                  <dt>Records</dt>
                  <dd>{parseResult.records.length.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Temperature</dt>
                  <dd>
                    {parseResult.records.some(
                      (record) =>
                        record.indoorTempF !== undefined || record.outdoorTempF !== undefined,
                    )
                      ? 'Included'
                      : 'Not included'}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {parseResult && parseResult.warnings.length > 0 && (
            <div className="parse-warnings" role="status">
              <p className="summary-label">Data warnings</p>
              <ul>
                {parseResult.warnings.map((warning) => (
                  <li key={formatIssue(warning)}>{formatIssue(warning)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="file-actions">
            <button type="button" onClick={handleReplace}>
              Replace file
            </button>
            <button className="secondary-button" type="button" onClick={handleRemove}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CsvUpload;
