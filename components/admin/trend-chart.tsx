"use client";
import { useEffect, useRef, useState, useId } from "react";
import type { CSSProperties } from "react";
import type { ChartMetric, TrafficChartData } from "@/features/admin/types";
import {
  chartMetrics,
  chartDate,
  comparison,
  countDomain,
  metricValue,
} from "@/features/admin/chart-format";

export function TrendChart({
  data,
  enabled,
  onEnabledChange,
  tableOpen,
  onTableOpenChange,
}: {
  data: TrafficChartData;
  enabled: ChartMetric[];
  onEnabledChange: (keys: ChartMetric[]) => void;
  tableOpen: boolean;
  onTableOpenChange: (open: boolean) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const frame = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(220, Math.round(entry.contentRect.width))),
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const selected = chartMetrics.filter((m) => enabled.includes(m.key));
  const counts = selected.filter((m) => m.key !== "applyConversion");
  const conversion = enabled.includes("applyConversion");
  const hourly = data.granularity === "hour";
  const { series, currentPeriod, previousPeriod } = data;
  const completed = series.filter((d) => !d.future);
  const hasEvents = currentPeriod.metrics.visitors > 0;
  const hasValues =
    counts.length > 0 ||
    (conversion && completed.some((d) => d.applyConversion !== null));
  const height = 280,
    left = counts.length ? 42 : 12,
    right = conversion ? width - 44 : width - 12,
    top = 26,
    bottom = 230;
  const domain = countDomain(
    Math.max(0, ...completed.flatMap((d) => counts.map((m) => d[m.key] ?? 0))),
  );
  const x = (i: number) =>
    left + (i / Math.max(1, series.length - 1)) * (right - left);
  const y = (value: number, key: ChartMetric) =>
    bottom -
    (value / (key === "applyConversion" ? 100 : domain)) * (bottom - top);
  const color = (key: ChartMetric) => `var(--chart-${key})`;
  const point = active === null ? null : series[active];
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const tickCount = width < 480 ? 3 : width < 750 ? 5 : 7;
  const ticks = [
    ...new Set(
      Array.from({ length: Math.min(tickCount, series.length) }, (_, i) =>
        Math.round(
          (i * (series.length - 1)) /
            (Math.min(tickCount, series.length) - 1 || 1),
        ),
      ),
    ),
  ];
  const toggle = (key: ChartMetric) =>
    onEnabledChange(
      enabled.includes(key)
        ? enabled.filter((k) => k !== key)
        : [...enabled, key],
    );
  const path = (key: ChartMetric) => {
    let drawing = false;
    return series
      .map((d, i) => {
        const value = d[key];
        if (d.future || value === null) {
          drawing = false;
          return "";
        }
        const command = drawing ? "L" : "M";
        drawing = true;
        return `${command}${x(i)},${y(value, key)}`;
      })
      .join(" ");
  };
  const summaryDate = (date: string) =>
    new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    });
  return (
    <section
      className="admin-panel traffic-chart"
      aria-label="Traffic and engagement"
    >
      <header className="traffic-chart-heading">
        <div>
          <h2>Traffic &amp; engagement</h2>
          <p>
            {hourly ? "Hourly" : "Daily"} activity · UTC ·{" "}
            {hourly ? "24 hourly slots" : `${series.length} daily slots`}
          </p>
        </div>
        <span className="traffic-chart-cadence">Auto-updates · 30s</span>
      </header>
      <div
        className="traffic-chart-selectors"
        role="group"
        aria-label="Chart metrics"
      >
        {chartMetrics.map((metric) => (
          <button
            type="button"
            key={metric.key}
            aria-pressed={enabled.includes(metric.key)}
            onClick={() => toggle(metric.key)}
            style={{ "--series-color": color(metric.key) } as CSSProperties}
          >
            <span className="traffic-chart-swatch" aria-hidden="true" />
            {metric.label}
            <span className="traffic-chart-check" aria-hidden="true">
              {enabled.includes(metric.key) ? "✓" : "+"}
            </span>
          </button>
        ))}
      </div>
      <div className="traffic-chart-totals" aria-label="Chart period totals">
        {selected.map((metric) => {
          const value = currentPeriod.metrics[metric.key];
          const delta = comparison(
            value,
            previousPeriod.metrics?.[metric.key] ?? null,
            metric.key,
          );
          return (
            <div
              key={metric.key}
              style={{ "--series-color": color(metric.key) } as CSSProperties}
            >
              <span>{metric.title}</span>
              <strong>{metricValue(value, metric.key)}</strong>
              <small className={`traffic-chart-change is-${delta.direction}`}>
                <span aria-hidden="true">
                  {delta.direction === "up"
                    ? "↗ "
                    : delta.direction === "down"
                      ? "↘ "
                      : ""}
                </span>
                {delta.text}
              </small>
            </div>
          );
        })}
      </div>
      <div className="traffic-chart-comparison">
        <span>
          {summaryDate(currentPeriod.start)} – {summaryDate(currentPeriod.end)}{" "}
          UTC
        </span>
        <span>
          {previousPeriod.available
            ? `vs ${summaryDate(previousPeriod.start)} – ${summaryDate(previousPeriod.end)} UTC · equal elapsed time`
            : "Comparison unavailable: the previous period exceeds 90-day retention."}
        </span>
      </div>
      <div className="traffic-chart-frame" ref={frame}>
        {!hasEvents || !selected.length || !hasValues ? (
          <div className="traffic-chart-empty" role="status">
            <strong>
              {!selected.length
                ? "Select a metric to explore the trend."
                : !hasEvents
                  ? "No analytics data for this period yet."
                  : "No job views to calculate conversion yet."}
            </strong>
            <p>
              {!hasEvents
                ? "Activity will appear here as visitors browse and apply."
                : "Use the controls above to compare your traffic and engagement."}
            </p>
          </div>
        ) : (
          <div
            className="traffic-chart-interaction"
            tabIndex={0}
            role="group"
            aria-label="Explore traffic chart"
            aria-describedby={descriptionId}
            onFocus={() =>
              setActive((index) => index ?? Math.max(0, completed.length - 1))
            }
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setActive(null);
                return;
              }
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              setActive((index) =>
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? series.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          series.length - 1,
                          (index ?? 0) + (event.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
              );
            }}
            onPointerMove={(event) => {
              if (event.pointerType === "touch") return;
              const rect = event.currentTarget.getBoundingClientRect();
              const px = ((event.clientX - rect.left) / rect.width) * width;
              setActive(
                Math.max(
                  0,
                  Math.min(
                    series.length - 1,
                    Math.round(
                      ((px - left) / (right - left)) * (series.length - 1),
                    ),
                  ),
                ),
              );
            }}
            onPointerDown={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setActive(
                Math.max(
                  0,
                  Math.min(
                    series.length - 1,
                    Math.round(
                      ((((event.clientX - rect.left) / rect.width) * width -
                        left) /
                        (right - left)) *
                        (series.length - 1),
                    ),
                  ),
                ),
              );
            }}
            onPointerLeave={(event) => {
              if (document.activeElement !== event.currentTarget)
                setActive(null);
            }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Traffic and engagement over the selected period"
            >
              <text x={left} y="12" className="traffic-chart-axis-title">
                {counts.length ? "Count" : ""}
              </text>
              {conversion && (
                <text
                  x={right}
                  y="12"
                  textAnchor="end"
                  className="traffic-chart-axis-title"
                >
                  Conversion %
                </text>
              )}
              {[0, 1, 2, 3, 4, 5].map((tick) => (
                <g key={tick}>
                  <line
                    x1={left}
                    x2={right}
                    y1={bottom - (tick / 5) * (bottom - top)}
                    y2={bottom - (tick / 5) * (bottom - top)}
                    className="traffic-chart-grid"
                  />
                  {counts.length > 0 && (
                    <text
                      x={left - 10}
                      y={bottom - (tick / 5) * (bottom - top) + 4}
                      textAnchor="end"
                    >
                      {compact.format((domain * tick) / 5)}
                    </text>
                  )}
                  {conversion && (
                    <text
                      x={right + 9}
                      y={bottom - (tick / 5) * (bottom - top) + 4}
                    >
                      {tick * 20}%
                    </text>
                  )}
                </g>
              ))}
              {ticks.map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={bottom + 26}
                  textAnchor={
                    i === 0
                      ? "start"
                      : i === series.length - 1
                        ? "end"
                        : "middle"
                  }
                >
                  {chartDate(series[i].timestamp, hourly)}
                </text>
              ))}
              {selected.map((metric) => (
                <g key={metric.key} data-series={metric.key}>
                  <path
                    d={path(metric.key)}
                    fill="none"
                    stroke={color(metric.key)}
                    strokeWidth="2"
                    strokeDasharray={metric.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {completed.map(
                    (d, i) =>
                      d[metric.key] !== null &&
                      (completed.length <= 7 ||
                        (completed[i - 1]?.[metric.key] == null &&
                          completed[i + 1]?.[metric.key] == null)) && (
                        <circle
                          key={d.timestamp}
                          cx={x(i)}
                          cy={y(d[metric.key]!, metric.key)}
                          r="2.5"
                          fill={color(metric.key)}
                        />
                      ),
                  )}
                </g>
              ))}
              {point && (
                <g>
                  <line
                    x1={x(active!)}
                    x2={x(active!)}
                    y1={top}
                    y2={bottom}
                    className="traffic-chart-guide"
                  />
                  {!point.future &&
                    selected.map(
                      (metric) =>
                        point[metric.key] !== null && (
                          <circle
                            key={metric.key}
                            cx={x(active!)}
                            cy={y(point[metric.key]!, metric.key)}
                            r="4"
                            fill={color(metric.key)}
                            stroke="var(--surface)"
                            strokeWidth="2"
                          />
                        ),
                    )}
                </g>
              )}
            </svg>
            {point && (
              <div
                className="traffic-chart-tooltip"
                role="status"
                style={{
                  left: `${Math.max(0, Math.min(width - 222, x(active!) + (x(active!) > width / 2 ? -234 : 12)))}px`,
                }}
              >
                <strong>{chartDate(point.timestamp, hourly, true)} UTC</strong>
                {point.future ? (
                  <p>This hour has not elapsed yet.</p>
                ) : (
                  <>
                    <small>
                      {point.partial
                        ? "Current interval · still collecting"
                        : hourly
                          ? "Hourly totals"
                          : "Daily totals"}
                    </small>
                    <dl>
                      {selected.map((metric) => (
                        <div key={metric.key}>
                          <dt>
                            <i style={{ background: color(metric.key) }} />
                            {metric.label}
                          </dt>
                          <dd>{metricValue(point[metric.key], metric.key)}</dd>
                        </div>
                      ))}
                    </dl>
                    {conversion && (
                      <small>
                        {point.applyUsers} of {point.jobViewers} job viewers
                        clicked Apply
                      </small>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="traffic-chart-help" id={descriptionId}>
        Hover or tap to inspect. Use ← / →, Home and End when the chart is
        focused. Current intervals are incomplete; future hours are not plotted.
      </p>
      {conversion && (
        <p className="traffic-chart-help">
          Conversion = unique job viewers who clicked Apply ÷ unique job viewers
          in the same interval. Repeat clicks count once. Period conversion is
          calculated across the full period; it is not an average of the points.
        </p>
      )}
      <details
        className="traffic-chart-data"
        open={tableOpen}
        onToggle={(event) => onTableOpenChange(event.currentTarget.open)}
      >
        <summary>View chart data</summary>
        <div className="admin-table-scroll">
          <table>
            <caption className="sr-only">
              Selected traffic metrics, {hourly ? "hourly" : "daily"}, UTC
            </caption>
            <thead>
              <tr>
                <th scope="col">Time (UTC)</th>
                {selected.map((m) => (
                  <th scope="col" key={m.key}>
                    {m.title}
                  </th>
                ))}
                <th scope="col">Interval</th>
              </tr>
            </thead>
            <tbody>
              {series.map((d) => (
                <tr key={d.timestamp}>
                  <th scope="row">{chartDate(d.timestamp, hourly, true)}</th>
                  {selected.map((m) => (
                    <td key={m.key}>
                      {d.future ? "—" : metricValue(d[m.key], m.key)}
                    </td>
                  ))}
                  <td>
                    {d.future
                      ? "Not elapsed"
                      : d.partial
                        ? "In progress"
                        : "Complete"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
