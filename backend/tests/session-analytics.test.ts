import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySession } from "../src/session-analytics.js";

const base = () => ({
  knownBot: false, pages: 1, jobViews: 0, searches: 0, filters: 0,
  applyClicks: 0, heartbeatCount: 0, distinctPaths: 1,
  startedAt: new Date("2026-01-01T00:00:00Z"),
  lastActivityAt: new Date("2026-01-01T00:00:50Z"),
});

test("classification separates crawler, uncertain first visit and engaged human", () => {
  assert.equal(classifySession(base()).visitorType, "UNCERTAIN");
  assert.deepEqual(classifySession({ ...base(), knownBot: true }), { botScore: 100, visitorType: "LIKELY_BOT" });
  assert.equal(classifySession({ ...base(), heartbeatCount: 1, searches: 1 }).visitorType, "HUMAN");
  assert.equal(classifySession({ ...base(), jobViews: 1 }).visitorType, "HUMAN");
});

test("rapid URL traversal scores as likely bot without blocking activity", () => {
  const result = classifySession({ ...base(), pages: 30, distinctPaths: 30, lastActivityAt: new Date("2026-01-01T00:00:20Z") });
  assert.equal(result.visitorType, "LIKELY_BOT");
  assert.ok(result.botScore <= 100);
});
