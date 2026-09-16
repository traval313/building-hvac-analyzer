import { useMemo, useState } from 'react';
import { HvacCsvRecord } from '../types/csvUpload';

type HvacTimeSeriesChartProps = {
  records: HvacCsvRecord[];
};

type ChartPoint = {
  record: HvacCsvRecord;
  x: number;
  y: number;
};

const chartWidth = 960;
const chartHeight = 360;
const margin = {
  top: 18,
  right: 28,
  bottom: 58,
  left: 72,
};

const plotWidth = chartWidth - margin.left - margin.right;
const plotHeight = chartHeight - margin.top - margin.bottom;

const formatDemand = (kw: number) =>
  `${kw.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kW`;

const formatTimestamp = (timestamp: Date) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);

const formatAxisTimestamp = (timestampMs: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  }).format(new Date(timestampMs));

const formatTemperature = (temperatureF?: number) =>
  typeof temperatureF === 'number'
    ? `${temperatureF.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })} F`
    : null;

const buildLinearTicks = (min: number, max: number, count: number) => {
  if (count <= 1 || min === max) {
    return [min];
  }

  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
};

const getTooltipPosition = (point: ChartPoint) => {
  const xPercent = (point.x / chartWidth) * 100;
  const yPercent = (point.y / chartHeight) * 100;

  return {
    left: `${Math.min(Math.max(xPercent, 14), 82)}%`,
    top: `${Math.min(Math.max(yPercent, 18), 74)}%`,
  };
};

function HvacTimeSeriesChart({ records }: HvacTimeSeriesChartProps) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const sortedRecords = [...records].sort((left, right) => left.timestampMs - right.timestampMs);

    if (sortedRecords.length === 0) {
      return null;
    }

    const startMs = sortedRecords[0].timestampMs;
    const endMs = Math.max(
      sortedRecords[sortedRecords.length - 1].intervalEndMs,
      sortedRecords[sortedRecords.length - 1].timestampMs,
    );
    const timeSpan = Math.max(endMs - startMs, 1);
    const maxDemand = Math.max(...sortedRecords.map((record) => record.hvacKw), 0);
    const yMax = maxDemand > 0 ? maxDemand * 1.12 : 1;

    const scaleX = (timestampMs: number) =>
      margin.left + ((timestampMs - startMs) / timeSpan) * plotWidth;
    const scaleY = (kw: number) => margin.top + plotHeight - (kw / yMax) * plotHeight;

    const points = sortedRecords.map((record) => ({
      record,
      x: scaleX(record.timestampMs),
      y: scaleY(record.hvacKw),
    }));

    const occupancyBands = sortedRecords.map((record) => {
      const x = scaleX(record.timestampMs);
      const intervalEndMs = Math.min(Math.max(record.intervalEndMs, record.timestampMs), endMs);
      const width = Math.max(scaleX(intervalEndMs) - x, 1);

      return {
        key: `${record.timestampMs}-${record.sourceRow}`,
        occupied: record.occupied,
        x,
        width,
      };
    });

    return {
      occupancyBands,
      points,
      xTicks: buildLinearTicks(startMs, endMs, 5),
      yMax,
      yTicks: buildLinearTicks(0, yMax, 5),
    };
  }, [records]);

  if (!chartData) {
    return (
      <div className="chart-empty" role="status">
        Upload valid HVAC records to view demand against occupancy.
      </div>
    );
  }

  const activePoint =
    activePointIndex === null ? null : chartData.points[activePointIndex] ?? null;
  const activeIndoorTemp = formatTemperature(activePoint?.record.indoorTempF);
  const activeOutdoorTemp = formatTemperature(activePoint?.record.outdoorTempF);
  const linePath = chartData.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="time-series-chart">
      <div className="chart-legend" aria-label="Chart legend">
        <span className="legend-item">
          <span className="legend-line" aria-hidden="true" />
          HVAC demand
        </span>
        <span className="legend-item">
          <span className="legend-occupied" aria-hidden="true" />
          Occupied period
        </span>
        <span className="legend-item">
          <span className="legend-unoccupied" aria-hidden="true" />
          Unoccupied period
        </span>
      </div>

      <div className="chart-canvas">
        <svg
          aria-label="HVAC electrical demand over time with occupied periods shown as patterned background bands"
          className="time-series-svg"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <defs>
            <pattern
              id="occupied-pattern"
              width="10"
              height="10"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="10" height="10" fill="#e3f2eb" />
              <line x1="0" x2="0" y1="0" y2="10" stroke="#8fc4ab" strokeWidth="4" />
            </pattern>
          </defs>

          <rect
            className="chart-plot-background"
            height={plotHeight}
            width={plotWidth}
            x={margin.left}
            y={margin.top}
          />

          {chartData.occupancyBands.map((band) => (
            <rect
              className={band.occupied ? 'chart-occupied-band' : 'chart-unoccupied-band'}
              height={plotHeight}
              key={band.key}
              width={band.width}
              x={band.x}
              y={margin.top}
            />
          ))}

          {chartData.yTicks.map((tick) => {
            const y = margin.top + plotHeight - (tick / chartData.yMax) * plotHeight;

            return (
              <g className="chart-grid-row" key={tick} transform={`translate(0 ${y})`}>
                <line x1={margin.left} x2={chartWidth - margin.right} y1="0" y2="0" />
                <text x={margin.left - 12} y="5">
                  {tick.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </text>
              </g>
            );
          })}

          {chartData.xTicks.map((tick) => {
            const firstTick = chartData.xTicks[0];
            const lastTick = chartData.xTicks[chartData.xTicks.length - 1];
            const x = margin.left + ((tick - firstTick) / Math.max(lastTick - firstTick, 1)) * plotWidth;

            return (
              <g className="chart-axis-tick" key={tick} transform={`translate(${x} 0)`}>
                <line
                  x1="0"
                  x2="0"
                  y1={margin.top + plotHeight}
                  y2={margin.top + plotHeight + 7}
                />
                <text y={margin.top + plotHeight + 26}>{formatAxisTimestamp(tick)}</text>
              </g>
            );
          })}

          <line
            className="chart-axis"
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={margin.top + plotHeight}
          />
          <line
            className="chart-axis"
            x1={margin.left}
            x2={chartWidth - margin.right}
            y1={margin.top + plotHeight}
            y2={margin.top + plotHeight}
          />

          <text
            className="chart-y-label"
            transform={`translate(22 ${margin.top + plotHeight / 2}) rotate(-90)`}
          >
            HVAC Demand (kW)
          </text>
          <text className="chart-x-label" x={margin.left + plotWidth / 2} y={chartHeight - 12}>
            Timestamp
          </text>

          <path className="chart-demand-line" d={linePath} />

          {chartData.points.map((point, index) => (
            <circle
              aria-label={`${formatTimestamp(point.record.timestamp)}. HVAC Demand: ${formatDemand(
                point.record.hvacKw,
              )}. Occupancy: ${point.record.occupied ? 'Occupied' : 'Unoccupied'}.`}
              className="chart-point"
              cx={point.x}
              cy={point.y}
              key={`${point.record.timestampMs}-${point.record.sourceRow}`}
              onBlur={() => setActivePointIndex(null)}
              onFocus={() => setActivePointIndex(index)}
              onMouseEnter={() => setActivePointIndex(index)}
              onMouseLeave={() => setActivePointIndex(null)}
              r="5"
              tabIndex={0}
            />
          ))}
        </svg>

        {activePoint && (
          <div className="chart-tooltip" role="status" style={getTooltipPosition(activePoint)}>
            <strong>{formatTimestamp(activePoint.record.timestamp)}</strong>
            <span>HVAC Demand: {formatDemand(activePoint.record.hvacKw)}</span>
            <span>Occupancy: {activePoint.record.occupied ? 'Occupied' : 'Unoccupied'}</span>
            {activeIndoorTemp && <span>Indoor Temp: {activeIndoorTemp}</span>}
            {activeOutdoorTemp && <span>Outdoor Temp: {activeOutdoorTemp}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default HvacTimeSeriesChart;
