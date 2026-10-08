"use client";
import { useState } from "react";
import type { Report } from "@/features/admin/types";
import world from "@/features/admin/world-map.json";
export function countryName(code: string | null) {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
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
