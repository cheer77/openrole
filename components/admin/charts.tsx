"use client";
import { useRef, useState } from "react";
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
  const [selectedCountry, setSelectedCountry] = useState("");
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastPointerTypeRef = useRef("");
  const lastTapRef = useRef({ country: "", time: 0 });
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });
  const max = Math.max(1, ...countries.map((c) => c.visitors));
  const count = (code: string) =>
    countries.find((c) => c.country === code)?.visitors || 0;
  const changeZoom = (nextZoom: number) => {
    const next = Math.min(5, Math.max(1, nextZoom));
    const viewport = viewportRef.current;
    const centerX = viewport
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth
      : 0.5;
    const centerY = viewport
      ? (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight
      : 0.5;

    setZoom(next);
    requestAnimationFrame(() => {
      const current = viewportRef.current;
      if (!current) return;
      current.scrollLeft = centerX * current.scrollWidth - current.clientWidth / 2;
      current.scrollTop = centerY * current.scrollHeight - current.clientHeight / 2;
    });
  };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || zoom === 1)
      return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      moved: false,
    };
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      drag.moved = true;
      viewport.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!drag.moved) return;
    viewport.scrollLeft = drag.scrollLeft - deltaX;
    viewport.scrollTop = drag.scrollTop - deltaY;
  };
  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = -1;
    setDragging(false);
    if (event.type === "pointercancel") dragRef.current.moved = false;
    else window.setTimeout(() => (dragRef.current.moved = false), 0);
  };
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
      <div className="map-toolbar">
        <div className="map-tooltip" role="status">
          {hover || "Hover, tap or focus a country to explore"}
        </div>
        <div className="map-zoom-controls" aria-label="Map zoom controls">
          <button
            type="button"
            onClick={() => changeZoom(zoom - 1)}
            disabled={zoom === 1}
            aria-label="Zoom out"
          >
            <span aria-hidden="true">−</span>
          </button>
          <button
            type="button"
            className="map-zoom-level"
            onClick={() => changeZoom(1)}
            disabled={zoom === 1}
            aria-label={`Reset map zoom. Current zoom ${zoom} times`}
          >
            {zoom}×
          </button>
          <button
            type="button"
            onClick={() => changeZoom(zoom + 1)}
            disabled={zoom === 5}
            aria-label="Zoom in"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
      <p className="map-touch-instruction">
        Double-tap a country to select it. Drag to move around the map.
      </p>
      <div
        className={`world-map-viewport${zoom > 1 ? " can-drag" : ""}${dragging ? " is-dragging" : ""}`}
        ref={viewportRef}
        tabIndex={zoom > 1 ? 0 : undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClickCapture={(event) => {
          if (!dragRef.current.moved) return;
          event.preventDefault();
          event.stopPropagation();
          dragRef.current.moved = false;
        }}
        aria-label={
          zoom > 1
            ? `World map at ${zoom} times zoom. Scroll to inspect regions.`
            : undefined
        }
      >
        <svg
          className={`world-map${selectedCountry ? " has-selection" : ""}`}
          style={{ width: `${zoom * 100}%` }}
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
                vectorEffect="non-scaling-stroke"
                fill={
                  selectedCountry === c.code
                    ? "#ff5252"
                    : visitors
                    ? `color-mix(in srgb, var(--brand) ${25 + (75 * visitors) / max}%, #ffe7e7)`
                    : "#e8edf2"
                }
                className={selectedCountry === c.code ? "is-selected" : undefined}
                tabIndex={visitors ? 0 : undefined}
                onMouseEnter={() => {
                  if (!selectedCountry || selectedCountry === c.code)
                    setHover(label);
                }}
                onFocus={() => {
                  if (!selectedCountry || selectedCountry === c.code)
                    setHover(label);
                }}
                onPointerDown={(event) => {
                  lastPointerTypeRef.current = event.pointerType;
                  if (event.pointerType !== "mouse") {
                    const now = Date.now();
                    const lastTap = lastTapRef.current;
                    if (
                      lastTap.country === c.code &&
                      now - lastTap.time <= 600
                    ) {
                      setHover(label);
                      setSelectedCountry(c.code);
                      lastTapRef.current = { country: "", time: 0 };
                    } else {
                      if (!selectedCountry || selectedCountry === c.code)
                        setHover(label);
                      lastTapRef.current = { country: c.code, time: now };
                    }
                  }
                }}
                onClick={(event) => {
                  if (
                    event.detail === 0 ||
                    lastPointerTypeRef.current === "mouse"
                  ) {
                    setHover(label);
                    setSelectedCountry(c.code);
                  }
                  lastPointerTypeRef.current = "";
                }}
                aria-label={label}
              >
                <title>{label}</title>
              </path>
            );
          })}
        </svg>
      </div>
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
