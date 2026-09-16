import { useEffect, useRef, useState } from 'react';
import BuildingConfigForm from './components/BuildingConfigForm';
import CsvUpload from './components/CsvUpload';
import EnergyBreakdownChart from './components/EnergyBreakdownChart';
import HvacTimeSeriesChart from './components/HvacTimeSeriesChart';
import { BuildingConfig } from './types/buildingConfig';
import { CsvParseResult, CsvUploadFile } from './types/csvUpload';
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
import { Severity } from './utils/severityClassification';

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

function App() {
  const summaryRef = useRef<HTMLElement>(null);
  const [buildingConfig, setBuildingConfig] = useState<BuildingConfig | null>(null);
  const [csvFile, setCsvFile] = useState<CsvUploadFile | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [analysisOrigin, setAnalysisOrigin] = useState<'uploaded' | 'sample' | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<SampleDatasetId | null>(null);
  const [buildingConfigStatus, setBuildingConfigStatus] = useState<'saved' | 'previous'>('saved');
  const [shouldScrollToSummary, setShouldScrollToSummary] = useState(false);
  const energySummary =
    buildingConfig && csvParseResult
      ? calculateHvacEnergySummary(csvParseResult.records, buildingConfig.electricityRate)
      : null;
  const unoccupiedEnergyDiagnostic = energySummary
    ? analyzeUnoccupiedEnergy(energySummary)
    : null;
  const startupShutdownDiagnostic = energySummary
    ? analyzeStartupShutdown(energySummary)
    : null;
  const closedDayActivityDiagnostic =
    energySummary && buildingConfig
      ? analyzeClosedDayActivity(energySummary, buildingConfig.normalOperatingDays)
      : null;
  const unoccupiedLoadRatioDiagnostic = energySummary
    ? analyzeUnoccupiedLoadRatio(energySummary)
    : null;
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
    if (!energySummary || !shouldScrollToSummary) {
      return;
    }

    summaryRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setShouldScrollToSummary(false);
  }, [energySummary, shouldScrollToSummary]);

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

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="Application header">
        <div>
          <p className="eyebrow">Commercial HVAC Operations Advisor</p>
          <h1>BuildingPulse</h1>
        </div>
        <button type="button">Export report</button>
      </header>

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

      {energySummary && (
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

      {csvParseResult && (
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
    </main>
  );
}

export default App;
