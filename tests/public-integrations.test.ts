import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/integrations/route.ts";
import { loadPublicIntegrations } from "../lib/public-integrations-client.ts";

const configuration = [{ provider: "ga4", identifier: "G-TEST1234" }];

test("integration endpoint caches only validated public configuration", async (t) => {
  let upstream = Response.json([{ ...configuration[0], secret: "must-not-leak" }]);
  t.mock.method(globalThis, "fetch", async () => upstream);
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), configuration);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, s-maxage=60");
  assert.equal(response.headers.get("set-cookie"), null);

  for (const failure of [
    new Response("unavailable", { status: 500 }),
    new Response("not json"),
    Response.json({ error: "unexpected payload" }),
    Response.json([{ provider: "ga4", identifier: "bad" }]),
    Response.json([{ provider: "toString", identifier: "bad" }]),
  ]) {
    upstream = failure;
    const result = await GET();
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  upstream = Response.json([]);
  const empty = await GET();
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("timeout"); });
  assert.equal((await GET()).status, 503);
});

test("browser shares requests, expires successes, and retries failed configurations", async (t) => {
  let now = 1000;
  let requests = 0;
  let fail = false;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    requests++;
    assert.equal(options.credentials, "omit");
    return fail ? Response.json([], { status: 503 }) : Response.json(configuration);
  });
  const first = loadPublicIntegrations();
  assert.equal(loadPublicIntegrations(), first);
  assert.deepEqual(await first, configuration);
  await loadPublicIntegrations();
  assert.equal(requests, 1);
  now += 60_001;
  fail = true;
  await assert.rejects(loadPublicIntegrations());
  await assert.rejects(loadPublicIntegrations());
  assert.equal(requests, 3);
  fail = false;
  assert.deepEqual(await loadPublicIntegrations(), configuration);
  await loadPublicIntegrations();
  assert.equal(requests, 4);
});
