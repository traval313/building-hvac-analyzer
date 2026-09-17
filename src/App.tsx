import { useEffect, useRef, useState } from 'react';
import BuildingConfigForm from './components/BuildingConfigForm';
import CsvUpload from './components/CsvUpload';
import EnergyBreakdownChart from './components/EnergyBreakdownChart';
import HvacTimeSeriesChart from './components/HvacTimeSeriesChart';
import { BuildingConfig } from './types/buildingConfig';
import { CsvParseIssue, CsvParseResult, CsvUploadFile } from './types/csvUpload';
import {
  analyzeClosedDayActivity,
  analyzeStartupShutdown,
  analyzeUnoccupiedEnergy,
  analyzeUnoccupiedLoadRatio,
} from './utils/diagnostics';
import { HVAC_ACTIVITY_THRESHOLD } from './utils/hvacActivity';
import { calculateHvacEnergySummary } from './utils/hvacEnergy';
import {
  classifyOverallReview,
  OVERALL_CLASSIFICATION_CONTENT,
} from './utils/overallClassification';
import { getDiagnosticRecommendations } from './utils/recommendationEngine';
import { sampleDatasets, SampleDataset, SampleDatasetId } from './utils/sampleDatasets';
import { parseCsvText } from './utils/csvParser';
import { Severity, SEVERITY_THRESHOLDS } from './utils/severityClassification';

const formatEnergy = (kwh: number) =>
  `${Math.round(kwh).toLocaleString()} kWh`;

const formatCost = (cost: number) =>
  cost.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const formatPercent = (percent: number) =>
  `${percent.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`;

const formatHours = (hours: number) =>
  `${hours.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} hr`;

const formatDemand = (kw: number) =>
  `${kw.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} kW`;

const formatSeverity = (severity: Severity) =>
  severity.charAt(0).toUpperCase() + severity.slice(1);

const formatThreshold = (value: number, unit: '%' | 'hr') =>
  `${value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}${unit === '%' ? '%' : ' hr'}`;

const thresholdSummaries = [
  {
    name: 'Unoccupied HVAC Energy',
    basis: 'Unoccupied HVAC energy share',
    unit: '%' as const,
    thresholds: SEVERITY_THRESHOLDS.unoccupiedEnergyShare,
  },
  {
    name: 'Startup & Shutdown',
    basis: 'Average post-occupancy runtime',
    unit: 'hr' as const,
    thresholds: SEVERITY_THRESHOLDS.postOccupancyRuntimeHours,
  },
  {
    name: 'Closed-Day Activity',
    basis: 'Closed-day HVAC energy share',
    unit: '%' as const,
    thresholds: SEVERITY_THRESHOLDS.closedDayEnergyShare,
  },
  {
    name: 'Unoccupied Load Ratio',
    basis: 'Average unoccupied demand / occupied demand',
    unit: '%' as const,
    thresholds: SEVERITY_THRESHOLDS.unoccupiedLoadRatio,
  },
];

const formatCsvIssue = (issue: CsvParseIssue) => {
  const location = issue.row ? `Row ${issue.row}: ` : '';
  return `${location}${issue.message}`;
};

type AnalysisResult = {
  energySummary: ReturnType<typeof calculateHvacEnergySummary>;
  unoccupiedEnergyDiagnostic: ReturnType<typeof analyzeUnoccupiedEnergy>;
  startupShutdownDiagnostic: ReturnType<typeof analyzeStartupShutdown>;
  closedDayActivityDiagnostic: ReturnType<typeof analyzeClosedDayActivity>;
  unoccupiedLoadRatioDiagnostic: ReturnType<typeof analyzeUnoccupiedLoadRatio>;
};

type AnalysisStatus = 'waiting' | 'running' | 'complete' | 'failed';
type AppPage = 'dashboard' | 'privacy-methodology';

function App() {
  const summaryRef = useRef<HTMLElement>(null);
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [buildingConfig, setBuildingConfig] = useState<BuildingConfig | null>(null);
  const [csvFile, setCsvFile] = useState<CsvUploadFile | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('waiting');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisAttempt, setAnalysisAttempt] = useState(0);
  const [analysisOrigin, setAnalysisOrigin] = useState<'uploaded' | 'sample' | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<SampleDatasetId | null>(null);
  const [buildingConfigStatus, setBuildingConfigStatus] = useState<'saved' | 'previous'>('saved');
  const [shouldScrollToSummary, setShouldScrollToSummary] = useState(false);
  const energySummary = analysisResult?.energySummary ?? null;
  const unoccupiedEnergyDiagnostic = analysisResult?.unoccupiedEnergyDiagnostic ?? null;
  const startupShutdownDiagnostic = analysisResult?.startupShutdownDiagnostic ?? null;
  const closedDayActivityDiagnostic = analysisResult?.closedDayActivityDiagnostic ?? null;
  const unoccupiedLoadRatioDiagnostic = analysisResult?.unoccupiedLoadRatioDiagnostic ?? null;
  const recommendations =
    unoccupiedEnergyDiagnostic &&
    startupShutdownDiagnostic &&
    closedDayActivityDiagnostic &&
    unoccupiedLoadRatioDiagnostic
      ? getDiagnosticRecommendations({
          unoccupiedEnergy: unoccupiedEnergyDiagnostic,
          startupShutdown: startupShutdownDiagnostic,
          closedDayActivity: closedDayActivityDiagnostic,
          unoccupiedLoadRatio: unoccupiedLoadRatioDiagnostic,
        })
      : [];
  const overallClassification =
    unoccupiedEnergyDiagnostic &&
    startupShutdownDiagnostic &&
    closedDayActivityDiagnostic &&
    unoccupiedLoadRatioDiagnostic
      ? classifyOverallReview([
          unoccupiedEnergyDiagnostic.severity,
          startupShutdownDiagnostic.postOccupancySeverity,
          closedDayActivityDiagnostic.severity,
          unoccupiedLoadRatioDiagnostic.severity,
        ])
      : null;
  const overallClassificationContent = overallClassification
    ? OVERALL_CLASSIFICATION_CONTENT[overallClassification]
    : null;

  useEffect(() => {
    if (analysisStatus !== 'complete' || !energySummary || !shouldScrollToSummary) {
      return;
    }

    summaryRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setShouldScrollToSummary(false);
  }, [analysisStatus, energySummary, shouldScrollToSummary]);

  useEffect(() => {
    if (!buildingConfig || !csvParseResult) {
      setAnalysisResult(null);
      setAnalysisStatus('waiting');
      setAnalysisError('');
      return;
    }

    setAnalysisStatus('running');
    setAnalysisError('');
    setAnalysisResult(null);

    const analysisTimer = window.setTimeout(() => {
      try {
        const nextEnergySummary = calculateHvacEnergySummary(
          csvParseResult.records,
          buildingConfig.electricityRate,
        );
        const nextUnoccupiedEnergyDiagnostic = analyzeUnoccupiedEnergy(nextEnergySummary);
        const nextStartupShutdownDiagnostic = analyzeStartupShutdown(nextEnergySummary);
        const nextClosedDayActivityDiagnostic = analyzeClosedDayActivity(
          nextEnergySummary,
          buildingConfig.normalOperatingDays,
        );
        const nextUnoccupiedLoadRatioDiagnostic = analyzeUnoccupiedLoadRatio(nextEnergySummary);

        setAnalysisResult({
          energySummary: nextEnergySummary,
          unoccupiedEnergyDiagnostic: nextUnoccupiedEnergyDiagnostic,
          startupShutdownDiagnostic: nextStartupShutdownDiagnostic,
          closedDayActivityDiagnostic: nextClosedDayActivityDiagnostic,
          unoccupiedLoadRatioDiagnostic: nextUnoccupiedLoadRatioDiagnostic,
        });
        setAnalysisStatus('complete');
      } catch {
        setAnalysisResult(null);
        setAnalysisStatus('failed');
        setAnalysisError(
          'Analysis could not be completed with this setup and CSV. Check the uploaded data, then retry or reset the analysis.',
        );
      }
    }, 450);

    return () => window.clearTimeout(analysisTimer);
  }, [analysisAttempt, buildingConfig, csvParseResult]);

  const handleCsvSelect = (file: CsvUploadFile, parseResult: CsvParseResult) => {
    setCsvFile(file);
    setCsvParseResult(parseResult);
    setAnalysisOrigin('uploaded');
    setActiveSampleId(null);
    setShouldScrollToSummary(true);
  };

  const handleCsvRemove = () => {
    setCsvFile(null);
    setCsvParseResult(null);
    setAnalysisResult(null);
    setAnalysisStatus('waiting');
    setAnalysisError('');
    setAnalysisOrigin(null);
    setActiveSampleId(null);
    setShouldScrollToSummary(false);
  };

  const handleBuildingConfigSubmit = (config: BuildingConfig) => {
    setBuildingConfig(config);
    setBuildingConfigStatus('saved');

    if (csvParseResult) {
      setShouldScrollToSummary(true);
    }
  };

  const handleAnalysisRetry = () => {
    setShouldScrollToSummary(true);
    setAnalysisAttempt((currentAttempt) => currentAttempt + 1);
  };

  const handleAnalysisReset = () => {
    handleCsvRemove();
  };

  const missingPrerequisites = [
    !buildingConfig ? 'Save building setup' : null,
    !csvParseResult ? 'Upload a valid CSV or load sample data' : null,
  ].filter((item): item is string => Boolean(item));

  const handleBuildingConfigClear = () => {
    if (buildingConfig) {
      setBuildingConfigStatus('previous');
    }
  };

  const handleSampleSelect = async (sample: SampleDataset) => {
    const parseResult = parseCsvText(sample.csvText);

    if (parseResult.errors.length > 0) {
      throw new Error('Sample dataset failed CSV validation.');
    }

    const file = new File([sample.csvText], sample.fileName, { type: 'text/csv' });

    setBuildingConfig(sample.buildingConfig);
    setBuildingConfigStatus('saved');
    setCsvFile(file);
    setCsvParseResult(parseResult);
    setAnalysisOrigin('sample');
    setActiveSampleId(sample.id);
    setShouldScrollToSummary(true);
  };

  const handlePageChange = (page: AppPage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Application header">
        <div>
          <p className="eyebrow">Commercial HVAC Operations Advisor</p>
          <h1>BuildingPulse</h1>
        </div>
        <nav className="topbar-nav" aria-label="Primary navigation">
          <button
            className={activePage === 'dashboard' ? 'nav-button active' : 'nav-button'}
            type="button"
            aria-current={activePage === 'dashboard' ? 'page' : undefined}
            onClick={() => handlePageChange('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={activePage === 'privacy-methodology' ? 'nav-button active' : 'nav-button'}
            type="button"
            aria-current={activePage === 'privacy-methodology' ? 'page' : undefined}
            onClick={() => handlePageChange('privacy-methodology')}
          >
            Privacy &amp; Methodology
          </button>
        </nav>
      </header>

      {activePage === 'privacy-methodology' && (
        <section className="policy-page" aria-labelledby="policy-title">
          <div className="policy-hero">
            <p className="eyebrow">Transparency Notes</p>
            <h2 id="policy-title">Privacy &amp; Methodology</h2>
            <p>
              BuildingPulse is an MVP decision-support tool for reviewing operational HVAC
              patterns. It documents observed activity from the uploaded data; it does not
              introduce new analytics or replace professional engineering judgment.
            </p>
          </div>

          <article className="policy-section">
            <div>
              <p className="summary-label">01</p>
              <h3>Data Privacy</h3>
            </div>
            <div className="policy-copy">
              <p className="policy-callout">
                Your building data stays in your browser. BuildingPulse processes uploaded CSV
                files locally and does not require building data to be sent to a BuildingPulse
                server for analysis.
              </p>
              <ul>
                <li>CSV files are processed locally in the user&apos;s browser.</li>
                <li>
                  BuildingPulse does not intentionally upload CSV contents to a backend or external
                  database.
                </li>
                <li>Uploaded files are used only for the current analysis session.</li>
                <li>The MVP does not require accounts or personal information.</li>
                <li>Included sample datasets are synthetic demo data.</li>
              </ul>
            </div>
          </article>

          <article className="policy-section">
            <div>
              <p className="summary-label">02</p>
              <h3>Analysis Methodology</h3>
            </div>
            <div className="policy-copy">
              <p>
                BuildingPulse reads timestamped HVAC demand and occupancy records, estimates HVAC
                interval energy, separates occupied and unoccupied periods, and compares observed
                patterns against the building setup provided for the analysis session.
              </p>
              <div className="method-grid">
                <div className="method-card">
                  <h4>Unoccupied HVAC Energy</h4>
                  <p>
                    Percentage of observed HVAC energy occurring during unoccupied periods.
                  </p>
                </div>
                <div className="method-card">
                  <h4>Startup &amp; Shutdown</h4>
                  <p>
                    HVAC activity before occupancy begins and after occupancy ends.
                  </p>
                </div>
                <div className="method-card">
                  <h4>Closed-Day Activity</h4>
                  <p>
                    HVAC energy occurring on days configured as normally closed.
                  </p>
                </div>
                <div className="method-card">
                  <h4>Unoccupied Load Ratio</h4>
                  <p>
                    Average unoccupied HVAC demand compared with average occupied demand.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="policy-section">
            <div>
              <p className="summary-label">03</p>
              <h3>Prototype Thresholds &amp; Assumptions</h3>
            </div>
            <div className="policy-copy">
              <p>
                Low, Moderate, and High classifications use MVP prototype thresholds from the same
                centralized severity configuration used by the diagnostic engine. They are review
                heuristics, not professional engineering standards.
              </p>
              <div className="threshold-table-wrapper">
                <table className="threshold-table">
                  <thead>
                    <tr>
                      <th scope="col">Diagnostic</th>
                      <th scope="col">Basis</th>
                      <th scope="col">Low</th>
                      <th scope="col">Moderate</th>
                      <th scope="col">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thresholdSummaries.map((threshold) => (
                      <tr key={threshold.name}>
                        <th scope="row">{threshold.name}</th>
                        <td>{threshold.basis}</td>
                        <td>
                          Below {formatThreshold(threshold.thresholds.moderateMin, threshold.unit)}
                        </td>
                        <td>
                          {formatThreshold(threshold.thresholds.moderateMin, threshold.unit)} to{' '}
                          {formatThreshold(threshold.thresholds.highAbove, threshold.unit)}
                        </td>
                        <td>
                          Above {formatThreshold(threshold.thresholds.highAbove, threshold.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="policy-callout warning">
                Significant startup/shutdown activity means HVAC demand is at least{' '}
                {formatThreshold(HVAC_ACTIVITY_THRESHOLD * 100, '%')} of that day&apos;s maximum
                HVAC demand. This is a prototype analytical assumption, not a threshold established
                by Trane Technologies, DOE, ENERGY STAR, ASHRAE, or another industry authority.
              </p>
            </div>
          </article>

          <article className="policy-section">
            <div>
              <p className="summary-label">04</p>
              <h3>Limitations &amp; Interpretation</h3>
            </div>
            <div className="policy-copy">
              <p className="policy-callout">
                BuildingPulse identifies operational patterns that may warrant further review.
                Results should be treated as decision-support information rather than confirmed
                equipment faults, energy waste, or guaranteed savings.
              </p>
              <ul>
                <li>Unoccupied HVAC activity is not automatically wasted energy.</li>
                <li>Early startup may be required for building preconditioning.</li>
                <li>
                  After-hours HVAC may support occupants, maintenance, ventilation, humidity
                  control, or other operational needs.
                </li>
                <li>Closed-day activity may have legitimate operational explanations.</li>
                <li>BuildingPulse does not diagnose HVAC equipment faults.</li>
                <li>Results are not a professional energy audit.</li>
                <li>Results do not guarantee potential energy or cost savings.</li>
                <li>
                  The MVP does not account for every factor affecting HVAC performance, such as
                  equipment characteristics, control sequences, weather, humidity, ventilation
                  requirements, or thermal behavior.
                </li>
              </ul>
            </div>
          </article>
        </section>
      )}

      {activePage === 'dashboard' && (
        <>

      <section className="hero" aria-labelledby="overview-title">
        <div className="hero-copy">
          <h2 id="overview-title">Turn HVAC operating data into actionable efficiency insights.</h2>
          <p>
            Upload commercial building HVAC and occupancy data to identify
            after-hours operation, closed-day activity, and other patterns that
            may indicate energy-saving opportunities.
          </p>
        </div>
        <img
          className="hero-icon"
          src="/buildingpulse-icon3.png"
          alt="HVAC analytics icon"
        />
      </section>

      <section className="workspace" aria-label="Building analysis workspace">
        <div className="panel setup-panel">
          <div className="panel-heading">
            <span>01</span>
            <h2>Building Setup</h2>
          </div>
          <BuildingConfigForm
            initialConfig={buildingConfig}
            onClear={handleBuildingConfigClear}
            onSubmit={handleBuildingConfigSubmit}
          />
          {buildingConfig && (
            <div className="config-summary" aria-live="polite">
              <p className="summary-label">
                {buildingConfigStatus === 'previous'
                  ? 'Previous configuration'
                  : 'Saved configuration'}
              </p>
              <h3>{buildingConfig.buildingName}</h3>
              <p>
                {buildingConfig.buildingType} building, ${buildingConfig.electricityRate.toFixed(4)}
                /kWh
              </p>
              <p>{buildingConfig.normalOperatingDays.join(', ')}</p>
            </div>
          )}
        </div>

        <div className="panel upload-panel">
          <div className="panel-heading">
            <span>02</span>
            <h2>CSV Upload</h2>
          </div>
          <CsvUpload
            selectedFile={csvFile}
            parseResult={csvParseResult}
            sampleDatasets={sampleDatasets}
            activeSampleId={activeSampleId}
            onFileSelect={handleCsvSelect}
            onFileRemove={handleCsvRemove}
            onSampleSelect={handleSampleSelect}
          />
        </div>
      </section>

      {analysisStatus !== 'complete' && (
        <section
          className={`panel analysis-panel analysis-state analysis-state-${analysisStatus}`}
          aria-labelledby="analysis-state-title"
          ref={summaryRef}
        >
          <div className="panel-heading">
            <span>03</span>
            <h2 id="analysis-state-title">Analysis Status</h2>
          </div>
          {analysisStatus === 'waiting' && (
            <div className="feedback-panel neutral" role="status">
              <p className="summary-label">Waiting for inputs</p>
              <h3>No analysis yet</h3>
              <p>
                Complete the required steps below and BuildingPulse will run the HVAC review
                automatically.
              </p>
              <ul className="status-checklist">
                {missingPrerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {analysisStatus === 'running' && (
            <div className="feedback-panel active" aria-live="polite" role="status">
              <span className="spinner" aria-hidden="true" />
              <p className="summary-label">Analyzing data</p>
              <h3>Reviewing HVAC patterns</h3>
              <p>
                Calculating energy totals, after-hours behavior, closed-day activity, and
                recommendations.
              </p>
            </div>
          )}
          {analysisStatus === 'failed' && (
            <div className="feedback-panel danger" role="alert">
              <p className="summary-label">Analysis failed</p>
              <h3>Results could not be generated</h3>
              <p>{analysisError}</p>
              <div className="file-actions">
                <button type="button" onClick={handleAnalysisRetry}>
                  Retry analysis
                </button>
                <button className="secondary-button" type="button" onClick={handleAnalysisReset}>
                  Reset upload
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {analysisStatus === 'complete' && energySummary && (
        <section
          className="panel analysis-panel"
          aria-labelledby="energy-summary-title"
          ref={summaryRef}
        >
          <div className="panel-heading">
            <span>03</span>
            <h2 id="energy-summary-title">HVAC Energy Summary</h2>
          </div>
          {analysisOrigin === 'sample' && activeSampleId && (
            <div className="demo-mode-banner" role="status">
              <strong>Synthetic demo data</strong>
              <span>
                {sampleDatasets.find((sample) => sample.id === activeSampleId)?.label}
              </span>
            </div>
          )}
          {csvParseResult && csvParseResult.warnings.length > 0 && (
            <div className="result-warning-panel" role="status">
              <p className="summary-label">Data quality warnings</p>
              <h3>Analysis completed with notes</h3>
              <ul>
                {csvParseResult.warnings.map((warning) => (
                  <li key={formatCsvIssue(warning)}>{formatCsvIssue(warning)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="metric-grid">
            <div className="metric">
              <p className="summary-label">Total HVAC Energy</p>
              <strong>{formatEnergy(energySummary.totalHvacEnergyKwh)}</strong>
            </div>
            <div className="metric">
              <p className="summary-label">Occupied HVAC Energy</p>
              <strong>{formatEnergy(energySummary.occupiedHvacEnergyKwh)}</strong>
            </div>
            <div className="metric">
              <p className="summary-label">Unoccupied HVAC Energy</p>
              <strong>{formatEnergy(energySummary.unoccupiedHvacEnergyKwh)}</strong>
            </div>
            <div className="metric">
              <p className="summary-label">Electricity Cost</p>
              <strong>{formatCost(energySummary.electricityCost)}</strong>
            </div>
          </div>
          {unoccupiedEnergyDiagnostic && (
            <EnergyBreakdownChart
              totalHvacEnergyKwh={energySummary.totalHvacEnergyKwh}
              occupiedHvacEnergyKwh={energySummary.occupiedHvacEnergyKwh}
              unoccupiedHvacEnergyKwh={energySummary.unoccupiedHvacEnergyKwh}
              unoccupiedEnergyShare={unoccupiedEnergyDiagnostic.unoccupiedEnergyShare}
            />
          )}
        </section>
      )}

      {analysisStatus === 'complete' && csvParseResult && (
        <section className="panel analysis-panel" aria-labelledby="time-series-title">
          <div className="panel-heading">
            <span>04</span>
            <h2 id="time-series-title">HVAC Demand &amp; Occupancy Timeline</h2>
          </div>
          <HvacTimeSeriesChart records={csvParseResult.records} />
        </section>
      )}

      {unoccupiedEnergyDiagnostic &&
        startupShutdownDiagnostic &&
        closedDayActivityDiagnostic &&
        unoccupiedLoadRatioDiagnostic && (
        <section className="panel analysis-panel" aria-labelledby="diagnostics-title">
          <div className="panel-heading">
            <span>05</span>
            <h2 id="diagnostics-title">Diagnostics</h2>
          </div>
          {overallClassification && overallClassificationContent && (
            <div className={`overall-finding overall-finding-${overallClassification}`}>
              <p className="summary-label">Overall review classification</p>
              <h3>{overallClassificationContent.label}</h3>
              <p>{overallClassificationContent.description}</p>
            </div>
          )}
          <div className="diagnostic-grid">
            <article className="diagnostic-card">
              <div className="diagnostic-title-row">
                <div>
                  <p className="summary-label">Diagnostic 1</p>
                  <h3>Unoccupied HVAC Energy</h3>
                </div>
                <span className={`severity severity-${unoccupiedEnergyDiagnostic.severity}`}>
                  Classification:{' '}
                  <strong>{formatSeverity(unoccupiedEnergyDiagnostic.severity)}</strong>
                </span>
              </div>
              <div className="metric-grid compact">
                <div className="metric">
                  <p className="summary-label">Energy</p>
                  <strong>
                    {formatEnergy(unoccupiedEnergyDiagnostic.unoccupiedEnergyKwh)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Share</p>
                  <strong>
                    {formatPercent(unoccupiedEnergyDiagnostic.unoccupiedEnergyShare)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Observed Cost</p>
                  <strong>{formatCost(unoccupiedEnergyDiagnostic.unoccupiedCost)}</strong>
                </div>
              </div>
              <p className="diagnostic-note">
                This is observed HVAC energy during unoccupied periods and may include required
                operation for preconditioning, ventilation, humidity control, maintenance, or other
                building needs.
              </p>
            </article>

            <article className="diagnostic-card">
              <div className="diagnostic-title-row">
                <div>
                  <p className="summary-label">Diagnostic 2</p>
                  <h3>Startup &amp; Shutdown</h3>
                </div>
                <span
                  className={`severity severity-${startupShutdownDiagnostic.postOccupancySeverity}`}
                >
                  Classification:{' '}
                  <strong>{formatSeverity(startupShutdownDiagnostic.postOccupancySeverity)}</strong>
                </span>
              </div>
              <div className="metric-grid compact">
                <div className="metric">
                  <p className="summary-label">Avg Pre-Occupancy</p>
                  <strong>
                    {formatHours(startupShutdownDiagnostic.averagePreOccupancyRuntimeHours)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Avg Post-Occupancy</p>
                  <strong>
                    {formatHours(startupShutdownDiagnostic.averagePostOccupancyRuntimeHours)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Analyzed Days</p>
                  <strong>{startupShutdownDiagnostic.analyzedDayCount}</strong>
                </div>
              </div>
              <p className="diagnostic-note">
                Significant HVAC activity is demand at or above {HVAC_ACTIVITY_THRESHOLD * 100}% of
                each day&apos;s maximum HVAC demand. Post-occupancy runtime is prioritized using the
                MVP review thresholds.
              </p>
            </article>

            <article className="diagnostic-card">
              <div className="diagnostic-title-row">
                <div>
                  <p className="summary-label">Diagnostic 3</p>
                  <h3>Closed-Day Activity</h3>
                </div>
                <span
                  className={`severity severity-${closedDayActivityDiagnostic.severity}`}
                >
                  Classification:{' '}
                  <strong>{formatSeverity(closedDayActivityDiagnostic.severity)}</strong>
                </span>
              </div>
              <div className="metric-grid compact">
                <div className="metric">
                  <p className="summary-label">Closed-Day Energy</p>
                  <strong>
                    {formatEnergy(closedDayActivityDiagnostic.closedDayEnergyKwh)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Energy Share</p>
                  <strong>
                    {formatPercent(closedDayActivityDiagnostic.closedDayEnergyShare)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Configured Closed Days</p>
                  <strong>
                    {closedDayActivityDiagnostic.closedDays.length > 0
                      ? closedDayActivityDiagnostic.closedDays.join(', ')
                      : 'None'}
                  </strong>
                </div>
              </div>
              <p className="diagnostic-note">
                This uses the configured normal operating days to identify records that fall on
                normally closed weekdays, then sums the existing interval HVAC energy values.
              </p>
            </article>

            <article className="diagnostic-card">
              <div className="diagnostic-title-row">
                <div>
                  <p className="summary-label">Diagnostic 4</p>
                  <h3>Unoccupied Load Ratio</h3>
                </div>
                <span
                  className={`severity severity-${unoccupiedLoadRatioDiagnostic.severity}`}
                >
                  Classification:{' '}
                  <strong>{formatSeverity(unoccupiedLoadRatioDiagnostic.severity)}</strong>
                </span>
              </div>
              <div className="metric-grid compact">
                <div className="metric">
                  <p className="summary-label">Avg Occupied Demand</p>
                  <strong>
                    {formatDemand(unoccupiedLoadRatioDiagnostic.averageOccupiedDemandKw)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Avg Unoccupied Demand</p>
                  <strong>
                    {formatDemand(unoccupiedLoadRatioDiagnostic.averageUnoccupiedDemandKw)}
                  </strong>
                </div>
                <div className="metric">
                  <p className="summary-label">Load Ratio</p>
                  <strong>
                    {formatPercent(unoccupiedLoadRatioDiagnostic.unoccupiedLoadRatio)}
                  </strong>
                </div>
              </div>
              <p className="diagnostic-note">
                This compares average original hvac_kw demand during unoccupied periods against
                average original hvac_kw demand during occupied periods.
              </p>
            </article>
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="panel analysis-panel" aria-labelledby="recommendations-title">
          <div className="panel-heading">
            <span>06</span>
            <h2 id="recommendations-title">Recommended Actions</h2>
          </div>
          <div className="recommendation-list">
            {recommendations.map((recommendation) => (
              <article
                className="recommendation-card"
                key={recommendation.id}
              >
                <div className="recommendation-title-row">
                  <div>
                    <p className="summary-label">
                      Diagnostic {recommendation.diagnosticNumber} - {recommendation.diagnosticName}
                    </p>
                    <h3>{recommendation.title}</h3>
                  </div>
                  <span className={`severity severity-${recommendation.severity}`}>
                    Priority: <strong>{formatSeverity(recommendation.severity)}</strong>
                  </span>
                </div>
                <p>{recommendation.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {analysisStatus === 'complete' &&
        unoccupiedEnergyDiagnostic &&
        startupShutdownDiagnostic &&
        closedDayActivityDiagnostic &&
        unoccupiedLoadRatioDiagnostic &&
        recommendations.length === 0 && (
        <section className="panel analysis-panel" aria-labelledby="recommendations-title">
          <div className="panel-heading">
            <span>06</span>
            <h2 id="recommendations-title">Recommended Actions</h2>
          </div>
          <div className="feedback-panel success" role="status">
            <p className="summary-label">No priority actions</p>
            <h3>No recommendations triggered</h3>
            <p>
              The uploaded data did not cross the current recommendation thresholds. Keep this
              report with the building record and rerun the review when schedules or occupancy
              patterns change.
            </p>
            <button className="secondary-button" type="button" onClick={handleAnalysisRetry}>
              Rerun analysis
            </button>
          </div>
        </section>
      )}
        </>
      )}
    </main>
  );
}

export default App;
