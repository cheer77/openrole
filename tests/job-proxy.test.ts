import { test } from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { NextRequest } from "next/server.js";

// Next's testing runtime expects the global installed by the Next server.
Object.assign(globalThis, { AsyncLocalStorage });
const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server.js");
// Compile the actual Proxy in memory so Node can resolve Next's extensionless import.
const compiled = ts.transpileModule(readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exported = {} as {
  config: Parameters<typeof unstable_doesMiddlewareMatch>[0]["config"];
  proxy: (request: NextRequest) => Promise<Response>;
};
new Function("require", "exports", compiled.outputText)(createRequire(import.meta.url), exported);

test("job matcher bypasses prefetch but retains documents and ordinary RSC navigation", () => {
  const matches = (url: string, headers: Record<string, string> = {}) =>
    unstable_doesMiddlewareMatch({ config: exported.config, nextConfig: {}, url, headers });
  assert.equal(matches("/jobs/example"), true);
  assert.equal(matches("/jobs/example?from=q%3DReact", { rsc: "1" }), true);
  assert.equal(matches("/jobs/example", { "next-router-prefetch": "1", rsc: "1" }), false);
  assert.equal(matches("/jobs/example", { purpose: "prefetch" }), false);
  assert.equal(matches("/jobs/example", { purpose: "navigate" }), true);
  for (const url of ["/jobs", "/api/integrations", "/admin", "/_next/static/example.js"])
    assert.equal(matches(url), false);
});

test("job status checks preserve active/closed passthrough, missing 404 and expired 410", async (t) => {
  let status = 200;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    assert.equal(init.method, "HEAD");
    assert.equal(init.cache, "no-store");
    return new Response(null, { status });
  });
  const request = new NextRequest("https://jobs.example.test/jobs/example?from=q%3DReact");
  assert.equal((await exported.proxy(request)).status, 200);
  status = 404;
  const missing = await exported.proxy(request);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("x-middleware-rewrite") ?? "", /\/_not-found$/);
  status = 410;
  const expired = await exported.proxy(request);
  assert.equal(expired.status, 410);
  assert.equal(expired.headers.get("x-robots-tag"), "noindex");
  t.mock.method(globalThis, "fetch", async () => { throw new Error("timeout"); });
  assert.equal((await exported.proxy(request)).status, 200);
});
