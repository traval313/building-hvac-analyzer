const workflowSteps = [
  'Configure Building',
  'Upload CSV',
  'Validate',
  'Analyze',
  'Review Findings',
  'Review Recommendations',
];

function App() {
  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">HVAC Operations Analyzer</p>
        <h1>BuildingPulse</h1>
        <p className="lede">
          A browser-based decision support tool for finding commercial HVAC
          schedule waste, unoccupied energy use, and operational savings.
        </p>
      </section>

      <section className="workflow" aria-label="MVP workflow">
        {workflowSteps.map((step, index) => (
          <article className="workflow-step" key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{step}</h2>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
