import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSalary, locationLabel } from "../lib/format.ts";
import type { Job } from "../features/jobs/types.ts";

test("unknown and partial annual salaries are displayed without invented bounds", () => {
  assert.equal(formatSalary(undefined), "Salary not listed");
  assert.equal(
    formatSalary({ min: 90000, max: null, currency: "EUR" }),
    "From €90,000",
  );
  assert.equal(
    formatSalary({ min: null, max: 110000, currency: "USD" }),
    "Up to $110,000",
  );
  assert.equal(
    formatSalary({ min: 90000, max: 90000, currency: "GBP" }),
    "£90,000",
  );
});
test("source location is preserved without inventing eligibility restrictions", () => {
  assert.equal(locationLabel({ location: "USA" } as Job), "USA");
  assert.equal(
    locationLabel({ location: "Dublin, Ireland; Remote in EU" } as Job),
    "Dublin, Ireland; Remote in EU",
  );
});
