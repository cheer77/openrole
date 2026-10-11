import { test } from "node:test";
import assert from "node:assert/strict";
import { readableCompanyName } from "../lib/company-display.ts";

test("verified legacy Greenhouse token has a readable employer name", () => {
  assert.equal(readableCompanyName("4lu44n1n37w012k"), "HelloFresh");
  assert.equal(readableCompanyName("Another employer"), "Another employer");
});
