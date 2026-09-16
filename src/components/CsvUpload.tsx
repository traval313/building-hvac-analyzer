import { ChangeEvent, KeyboardEvent, useRef, useState } from 'react';
import { CsvParseIssue, CsvParseResult, CsvUploadFile } from '../types/csvUpload';
import { parseCsvFile } from '../utils/csvParser';
import { SampleDataset, SampleDatasetId } from '../utils/sampleDatasets';

type CsvUploadProps = {
  selectedFile: CsvUploadFile | null;
  parseResult: CsvParseResult | null;
  sampleDatasets: SampleDataset[];
  activeSampleId: SampleDatasetId | null;
  onFileSelect: (file: CsvUploadFile, parseResult: CsvParseResult) => void;
  onFileRemove: () => void;
  onSampleSelect: (sample: SampleDataset) => Promise<void>;
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

const formatHours = (hours: number) => {
  if (hours < 1) {
    return `${Number((hours * 60).toFixed(2))} min`;
  }

  return `${Number(hours.toFixed(2))} hr`;
};

const getDatasetCoverageHours = (parseResult: CsvParseResult) => {
  const firstRecord = parseResult.records[0];
  const lastRecord = parseResult.records[parseResult.records.length - 1];

  if (!firstRecord || !lastRecord) {
    return 0;
  }

  return (lastRecord.intervalEndMs - firstRecord.timestampMs) / 3600000;
};

function CsvUpload({
  selectedFile,
  parseResult,
  sampleDatasets,
  activeSampleId,
  onFileSelect,
  onFileRemove,
  onSampleSelect,
}: CsvUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingLabel, setPreparingLabel] = useState('');
  const [loadingSampleId, setLoadingSampleId] = useState<SampleDatasetId | null>(null);
  const [previewSample, setPreviewSample] = useState<SampleDataset | null>(null);

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setErrors([]);

    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setErrors(['Select a CSV file with a .csv extension.']);
      resetInput();
      return;
    }

    setIsPreparing(true);
    setPreparingLabel(`Validating ${file.name}`);

    try {
      const result = await parseCsvFile(file);

      if (result.errors.length > 0) {
        setErrors(result.errors.map(formatIssue));
        resetInput();
        return;
      }

      onFileSelect(file, result);
    } catch {
      setErrors(['Unable to read this CSV file. Try exporting a fresh CSV and upload it again.']);
      resetInput();
    } finally {
      setIsPreparing(false);
      setPreparingLabel('');
    }
  };

  const handleSampleSelect = async (sample: SampleDataset) => {
    if (isPreparing) {
      return;
    }

    resetInput();
    setErrors([]);
    setIsPreparing(true);
    setPreparingLabel(`Loading ${sample.label}`);
    setLoadingSampleId(sample.id);

    try {
      await onSampleSelect(sample);
    } catch {
      setErrors(['Unable to load this sample dataset. Try another sample or upload a CSV.']);
    } finally {
      setIsPreparing(false);
      setPreparingLabel('');
      setLoadingSampleId(null);
    }
  };

  const handleRemove = () => {
    resetInput();
    setErrors([]);
    setIsPreparing(false);
    setPreparingLabel('');
    onFileRemove();
  };

  const handleReplace = () => {
    inputRef.current?.click();
  };

  const handleSampleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    sample: SampleDataset,
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    void handleSampleSelect(sample);
  };

  return (
    <div className="csv-upload">
      <label className="csv-picker" htmlFor="csvFile">
        <span className="csv-picker-title">Select local CSV file</span>
        <span className="csv-picker-subtitle">CSV contents stay in this browser.</span>
        <input
          accept=".csv,text/csv"
          aria-describedby={errors.length > 0 ? 'csv-upload-error' : undefined}
          aria-invalid={errors.length > 0}
          disabled={isPreparing}
          id="csvFile"
          name="csvFile"
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
      </label>

      {!selectedFile && !isPreparing && errors.length === 0 && (
        <div className="upload-empty-state" role="status">
          <p className="summary-label">No file loaded</p>
          <h3>Upload data or choose a sample</h3>
          <p>
            Expected columns are timestamp, occupied, and hvac_kw. Optional temperature columns are
            supported.
          </p>
        </div>
      )}

      <section className="sample-data-section" aria-labelledby="sample-data-title">
        <div>
          <p className="summary-label">Try sample data</p>
          <h3 id="sample-data-title">Synthetic reviewer scenarios</h3>
        </div>
        <div className="sample-data-options">
          {sampleDatasets.map((sample) => {
            const isActive = activeSampleId === sample.id;
            const isLoading = loadingSampleId === sample.id;

            return (
              <div
                aria-disabled={isPreparing}
                className={isActive ? 'sample-data-option active' : 'sample-data-option'}
                key={sample.id}
                onClick={() => void handleSampleSelect(sample)}
                onKeyDown={(event) => handleSampleKeyDown(event, sample)}
                role="button"
                tabIndex={isPreparing ? -1 : 0}
              >
                <span>
                  <strong>{sample.label}</strong>
                  <small>{sample.description}</small>
                </span>
                <span className="sample-data-actions">
                  <button
                    className="sample-data-view"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewSample(sample);
                    }}
                    type="button"
                  >
                    View CSV
                  </button>
                  {(isLoading || isActive) && (
                    <span className="sample-data-status">
                      {isLoading ? 'Loading...' : 'Loaded'}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {previewSample && (
        <div
          className="sample-preview-backdrop"
          onClick={() => setPreviewSample(null)}
          role="presentation"
        >
          <section
            aria-labelledby="sample-preview-title"
            aria-modal="true"
            className="sample-preview-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="sample-preview-header">
              <div>
                <p className="summary-label">Sample CSV</p>
                <h3 id="sample-preview-title">{previewSample.fileName}</h3>
              </div>
              <button
                aria-label="Close sample CSV preview"
                className="sample-preview-close"
                onClick={() => setPreviewSample(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <pre className="sample-preview-content">
              <code>{previewSample.csvText}</code>
            </pre>
          </section>
        </div>
      )}

      {isPreparing && (
        <div className="upload-status" aria-live="polite" role="status">
          <span className="spinner small" aria-hidden="true" />
          <span>{preparingLabel || 'Preparing CSV records'}</span>
        </div>
      )}

      {errors.length > 0 && (
        <div className="validation-panel" id="csv-upload-error" role="alert">
          <p className="summary-label">CSV validation error</p>
          <h3>File was not loaded</h3>
          <ul>
            {errors.slice(0, 6).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          {errors.length > 6 && (
            <p>{errors.length - 6} more issue{errors.length - 6 === 1 ? '' : 's'} found.</p>
          )}
          <button className="secondary-button" type="button" onClick={handleReplace}>
            Try another CSV
          </button>
        </div>
      )}

      {selectedFile && !isPreparing && (
        <div className="file-summary" aria-live="polite">
          {activeSampleId && (
            <div className="demo-data-label">
              <strong>Synthetic demo data</strong>
              <span>
                {sampleDatasets.find((sample) => sample.id === activeSampleId)?.label}
              </span>
            </div>
          )}
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
                  <dt>Coverage</dt>
                  <dd>{formatHours(getDatasetCoverageHours(parseResult))}</dd>
                </div>
                <div>
                  <dt>Typical interval</dt>
                  <dd>{formatHours(parseResult.records.at(-1)?.intervalHours ?? 0)}</dd>
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
              {activeSampleId ? 'Exit sample mode' : 'Remove'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CsvUpload;
