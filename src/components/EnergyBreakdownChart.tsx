type EnergyBreakdownChartProps = {
  totalHvacEnergyKwh: number;
  occupiedHvacEnergyKwh: number;
  unoccupiedHvacEnergyKwh: number;
  unoccupiedEnergyShare: number;
};

type DonutSegment = {
  label: 'Occupied' | 'Unoccupied';
  energyKwh: number;
  share: number;
  strokeClassName: string;
};

const chartSize = 220;
const chartCenter = chartSize / 2;
const strokeWidth = 34;
const radius = 78;
const circumference = 2 * Math.PI * radius;

const formatEnergy = (kwh: number) =>
  `${Math.round(kwh).toLocaleString()} kWh`;

const formatPercent = (percent: number) =>
  `${percent.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`;

const clampShare = (share: number) => Math.min(Math.max(share, 0), 100);

function EnergyBreakdownChart({
  totalHvacEnergyKwh,
  occupiedHvacEnergyKwh,
  unoccupiedHvacEnergyKwh,
  unoccupiedEnergyShare,
}: EnergyBreakdownChartProps) {
  const safeTotalEnergy = Math.max(totalHvacEnergyKwh, 0);
  const safeUnoccupiedShare = clampShare(unoccupiedEnergyShare);
  const occupiedShare = clampShare(100 - safeUnoccupiedShare);
  const unoccupiedDash = (safeUnoccupiedShare / 100) * circumference;
  const occupiedDash = circumference - unoccupiedDash;
  const occupiedDashOffset = -unoccupiedDash;
  const hasObservedEnergy = safeTotalEnergy > 0;
  const segments: DonutSegment[] = [
    {
      label: 'Unoccupied',
      energyKwh: unoccupiedHvacEnergyKwh,
      share: safeUnoccupiedShare,
      strokeClassName: 'energy-breakdown-segment-unoccupied',
    },
    {
      label: 'Occupied',
      energyKwh: occupiedHvacEnergyKwh,
      share: occupiedShare,
      strokeClassName: 'energy-breakdown-segment-occupied',
    },
  ];

  return (
    <section className="energy-breakdown" aria-labelledby="energy-breakdown-title">
      <div className="energy-breakdown-copy">
        <p className="summary-label">Diagnostic 1 context</p>
        <h3 id="energy-breakdown-title">Occupied vs. Unoccupied Energy</h3>
        <p>
          Total observed HVAC energy is split by occupancy state using the existing interval
          energy totals.
        </p>
      </div>

      <div className="energy-breakdown-chart-row">
        <svg
          aria-label={`Observed HVAC energy breakdown. ${formatEnergy(
            occupiedHvacEnergyKwh,
          )} occupied, ${formatEnergy(unoccupiedHvacEnergyKwh)} unoccupied, ${formatPercent(
            safeUnoccupiedShare,
          )} unoccupied share.`}
          className="energy-breakdown-svg"
          role="img"
          viewBox={`0 0 ${chartSize} ${chartSize}`}
        >
          <defs>
            <pattern
              id="energy-breakdown-occupied-pattern"
              width="8"
              height="8"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#24745a" />
              <line x1="0" x2="0" y1="0" y2="8" stroke="#8fc4ab" strokeWidth="3" />
            </pattern>
            <pattern
              id="energy-breakdown-unoccupied-pattern"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#5c2d91" />
              <path d="M0 8 L8 0" stroke="#d8c4ef" strokeWidth="2" />
            </pattern>
          </defs>

          <circle
            className="energy-breakdown-track"
            cx={chartCenter}
            cy={chartCenter}
            fill="none"
            r={radius}
            strokeWidth={strokeWidth}
          />
          {hasObservedEnergy && (
            <>
              <circle
                className="energy-breakdown-segment energy-breakdown-segment-unoccupied"
                cx={chartCenter}
                cy={chartCenter}
                fill="none"
                r={radius}
                strokeDasharray={`${unoccupiedDash} ${circumference - unoccupiedDash}`}
                strokeLinecap="butt"
                strokeWidth={strokeWidth}
                transform={`rotate(-90 ${chartCenter} ${chartCenter})`}
              />
              <circle
                className="energy-breakdown-segment energy-breakdown-segment-occupied"
                cx={chartCenter}
                cy={chartCenter}
                fill="none"
                r={radius}
                strokeDasharray={`${occupiedDash} ${circumference - occupiedDash}`}
                strokeDashoffset={occupiedDashOffset}
                strokeLinecap="butt"
                strokeWidth={strokeWidth}
                transform={`rotate(-90 ${chartCenter} ${chartCenter})`}
              />
            </>
          )}
          <text className="energy-breakdown-center-label" x={chartCenter} y={chartCenter - 8}>
            Unoccupied
          </text>
          <text className="energy-breakdown-center-value" x={chartCenter} y={chartCenter + 20}>
            {formatPercent(safeUnoccupiedShare)}
          </text>
        </svg>

        <dl className="energy-breakdown-list" aria-label="Energy breakdown values">
          {segments.map((segment) => (
            <div className="energy-breakdown-list-item" key={segment.label}>
              <dt>
                <span
                  className={`energy-breakdown-swatch ${segment.strokeClassName}`}
                  aria-hidden="true"
                />
                {segment.label}
              </dt>
              <dd>
                <strong>{formatEnergy(segment.energyKwh)}</strong>
                <span>{formatPercent(segment.share)} of total</span>
              </dd>
            </div>
          ))}
          <div className="energy-breakdown-list-item total">
            <dt>Total observed HVAC energy</dt>
            <dd>
              <strong>{formatEnergy(totalHvacEnergyKwh)}</strong>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default EnergyBreakdownChart;
