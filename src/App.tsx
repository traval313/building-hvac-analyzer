function App() {
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
          src="/temp-hvac-icon.png"
          alt="HVAC analytics icon"
        />
      </section>

      <section className="workspace" aria-label="Building analysis workspace">
        <div className="panel setup-panel">
          <div className="panel-heading">
            <span>01</span>
            <h2>Building Setup</h2>
          </div>
        </div>

        <div className="panel upload-panel">
          <div className="panel-heading">
            <span>02</span>
            <h2>CSV Upload</h2>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
