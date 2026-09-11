import { useState } from 'react';
import BuildingConfigForm from './components/BuildingConfigForm';
import CsvUpload from './components/CsvUpload';
import { BuildingConfig } from './types/buildingConfig';
import { CsvParseResult, CsvUploadFile } from './types/csvUpload';

function App() {
  const [buildingConfig, setBuildingConfig] = useState<BuildingConfig | null>(null);
  const [csvFile, setCsvFile] = useState<CsvUploadFile | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);

  const handleCsvSelect = (file: CsvUploadFile, parseResult: CsvParseResult) => {
    setCsvFile(file);
    setCsvParseResult(parseResult);
  };

  const handleCsvRemove = () => {
    setCsvFile(null);
    setCsvParseResult(null);
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
            onSubmit={setBuildingConfig}
          />
          {buildingConfig && (
            <div className="config-summary" aria-live="polite">
              <p className="summary-label">Saved configuration</p>
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
            onFileSelect={handleCsvSelect}
            onFileRemove={handleCsvRemove}
          />
        </div>
      </section>
    </main>
  );
}

export default App;
