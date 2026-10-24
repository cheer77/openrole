import test from "node:test";
import assert from "node:assert/strict";
import { publishedAtForSync } from "../src/sync.js";
import { parseCleanupOptions } from "../src/jobs/clear-lever-published-at.js";

test("Lever does not retain a historical posting-record creation date", () => {
  const old = new Date("2025-01-01T00:00:00Z");
  assert.equal(publishedAtForSync("LEVER", null, old), null);
  assert.equal(publishedAtForSync("ASHBY", null, old), old);
  const verified = new Date("2026-01-01T00:00:00Z");
  assert.equal(publishedAtForSync("LEVER", verified, old), verified);
});

test("Lever date cleanup is dry-run by default and requires two apply confirmations", () => {
  assert.deepEqual(parseCleanupOptions([]), { apply: false });
  assert.throws(() => parseCleanupOptions(["--apply"]));
  assert.throws(() => parseCleanupOptions([
    "--apply", "--confirm-database=vmiyou", "--confirm-count=not-a-number",
  ]));
  assert.deepEqual(parseCleanupOptions([
    "--apply", "--confirm-database=vmiyou", "--confirm-count=12",
  ]), { apply: true, confirmDatabase: "vmiyou", confirmCount: 12 });
  assert.throws(() => parseCleanupOptions(["--unexpected"]));
});
