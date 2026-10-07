import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateRange,
  deviceInfo,
  eventSchema,
  trafficSource,
} from "../src/analytics.js";
import { rateLimit } from "../src/admin-auth.js";
test("analytics attribution accepts only known hosts or exact campaign source names", () => {
  assert.equal(trafficSource("", "www.google.com"), "Google");
  assert.equal(trafficSource("", "google.com.evil.test"), "Other");
  assert.equal(trafficSource("telegram", ""), "Telegram");
  assert.equal(trafficSource("", "l.facebook.com"), "Facebook");
  assert.equal(trafficSource(), "Direct");
  assert.equal(deviceInfo("Mozilla iPhone Mobile Safari").os, "iOS");
});
test("date windows use UTC, including month boundaries", () => {
  const now = new Date("2026-10-01T12:30:00Z");
  assert.equal(
    dateRange("7", now).start.toISOString(),
    "2026-09-25T00:00:00.000Z",
  );
  assert.equal(
    dateRange("yesterday", now).start.toISOString(),
    "2026-09-30T00:00:00.000Z",
  );
  assert.equal(
    dateRange("yesterday", now).end.toISOString(),
    "2026-10-01T00:00:00.000Z",
  );
  assert.throws(() => dateRange("all", now));
});
test("analytics cannot accept account routes, query strings, client timestamps or raw IP", () => {
  const base = {
    id: crypto.randomUUID(),
    visitorId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    type: "PAGE_VIEW",
    path: "/",
  };
  assert.ok(eventSchema.safeParse(base).success);
  for (const patch of [
    { path: "/admin" },
    { path: "/login" },
    { path: "/jobs?q=email" },
    { ip: "1.2.3.4" },
    { occurredAt: "2020-01-01" },
  ])
    assert.equal(eventSchema.safeParse({ ...base, ...patch }).success, false);
});
test("rate limiter rejects requests beyond its budget", () => {
  const key = crypto.randomUUID();
  rateLimit(key, 1, 60000);
  assert.throws(() => rateLimit(key, 1, 60000));
});
