import { test } from "node:test";
import assert from "node:assert/strict";
import { locationLabel } from "../lib/format.ts";

test("location adds a known country once and preserves unknown geography", () => {
  assert.equal(locationLabel({ location: "Magdeburg, Saxony-Anhalt", country: "DE" }), "Magdeburg, Saxony-Anhalt, Germany");
  assert.equal(locationLabel({ location: "Berlin, Germany", country: "DE" }), "Berlin, Germany");
  assert.equal(locationLabel({ location: "Somewhere", country: null }), "Somewhere");
});
