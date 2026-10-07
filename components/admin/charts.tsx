"use client";
import { useState, useId } from "react";
import type { Report, Metrics } from "@/features/admin/types";
import world from "@/features/admin/world-map.json";
export function countryName(code: string | null) {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}
export function TrendChart({
  data,
  metric,
  label,
}: {
  data: Report["series"];
  metric: keyof Metrics;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const max = Math.max(1, ...data.map((d) => d[metric]));
  const x = (i: number) => 42 + (i / Math.max(1, data.length - 1)) * 690;
  const y = (v: number) => 190 - (v / max) * 155;
  const points = data.map((d, i) => `${x(i)},${y(d[metric])}`).join(" ");
  const selected = active !== null ? data[active] : null;
  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-GB", {
      month: "short",
      day: "numeric",
      ...(data.length <= 24 ? { hour: "2-digit", minute: "2-digit" } : {}),
      timeZone: "UTC",
    });
  return (
    <div className="admin-chart">
      <div className="chart-heading">
        <h2>{label}</h2>
        <span aria-live="polite">
          {selected
            ? `${formatDate(selected.date)} · ${selected[metric]}${metric === "ctr" ? "%" : ""}`
            : "Hover or focus a point"}
        </span>
      </div>
      <svg
        viewBox="0 0 760 230"
        role="img"
        aria-label={`${label} over the selected period`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--brand)" stopOpacity=".18" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="42"
              y1={y(max * t)}
              x2="732"
              y2={y(max * t)}
              stroke="var(--border)"
              strokeDasharray="4 5"
            />
            <text x="32" y={y(max * t) + 4} textAnchor="end">
              {Math.round(max * t * 10) / 10}
            </text>
          </g>
        ))}
        {points && (
          <>
            <polygon points={`42,190 ${points} 732,190`} fill={`url(#${id})`} />
            <polyline
              points={points}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </>
        )}
        {data.map((d, i) => (
          <circle
            key={d.date}
            cx={x(i)}
            cy={y(d[metric])}
            r={active === i ? 5 : 3}
            fill="var(--brand)"
            tabIndex={0}
            onFocus={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={`${formatDate(d.date)}: ${d[metric]}${metric === "ctr" ? " percent" : ""}`}
          >
            <title>
              {formatDate(d.date)}: {d[metric]}
            </title>
          </circle>
        ))}
        {data.length > 0 && (
          <>
            <text x="42" y="222">
              {formatDate(data[0].date)}
            </text>
            <text x="732" y="222" textAnchor="end">
              {formatDate(data.at(-1)!.date)}
            </text>
          </>
        )}
      </svg>
      <details>
        <summary>View chart data</summary>
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>{label}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{formatDate(d.date)}</td>
                  <td>
                    {d[metric]}
                    {metric === "ctr" ? "%" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function WorldMap({
  countries,
  total,
}: {
  countries: Report["countries"];
  total: number;
}) {
  const [hover, setHover] = useState("");
  const max = Math.max(1, ...countries.map((c) => c.visitors));
  const count = (code: string) =>
    countries.find((c) => c.country === code)?.visitors || 0;
  return (
    <section className="admin-panel world-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Your audience, worldwide</h2>
          <p>Country-level estimates from trusted hosting headers.</p>
        </div>
        <span className="admin-chip">
          {countries.filter((c) => c.country).length} countries
        </span>
      </div>
      <div className="map-tooltip" role="status">
        {hover || "Hover, tap or focus a country to explore"}
      </div>
      <svg
        className="world-map"
        viewBox="0 0 720 310"
        role="img"
        aria-label="Visitors by country"
      >
        {world.map((c) => {
          const visitors = count(c.code);
          const label = `${c.name} · ${visitors} visitors · ${total ? ((visitors / total) * 100).toFixed(1) : 0}% of traffic`;
          return (
            <path
              key={c.code}
              d={c.path}
              stroke="var(--surface)"
              strokeWidth=".65"
              fill={
                visitors
                  ? `color-mix(in srgb, var(--brand) ${25 + (75 * visitors) / max}%, #ffe7e7)`
                  : "#e8edf2"
              }
              tabIndex={visitors ? 0 : undefined}
              onMouseEnter={() => setHover(label)}
              onFocus={() => setHover(label)}
              onClick={() => setHover(label)}
              aria-label={label}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <div className="map-legend">
        <span>No data</span>
        <i />
        <span>More visitors</span>
      </div>
      {countries.every((c) => !c.country) && (
        <p className="admin-muted">
          No country data yet. Unknown locations are retained in the table
          below.
        </p>
      )}
      <small>Made with Natural Earth · approximate geography</small>
    </section>
  );
}
