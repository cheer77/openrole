import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparison,
  countDomain,
  chartDate,
  metricValue,
} from "../features/admin/chart-format.ts";
test("chart distinguishes percentage points, relative changes and missing baselines", () => {
  assert.deepEqual(comparison(120, 100, "visitors"), {
    text: "+20.0%",
    direction: "up",
  });
  assert.deepEqual(comparison(20, 40, "jobViews"), {
    text: "−50.0%",
    direction: "down",
  });
  assert.equal(comparison(9.3, 8.5, "applyConversion").text, "+0.8 pp");
  assert.equal(comparison(3, 0, "applyClicks").text, "New activity");
  assert.equal(comparison(0, 0, "visitors").text, "No change");
  assert.equal(comparison(null, 0, "applyConversion").text, "Not available");
  assert.equal(metricValue(null, "applyConversion"), "—");
});
test("small counts have a readable integer scale and date labels follow explicit granularity", () => {
  assert.equal(countDomain(2), 5);
  assert.equal(countDomain(0), 5);
  assert.equal(countDomain(4800), 5000);
  assert.equal(chartDate("2035-10-07T14:00:00Z", true), "14:00");
  assert.equal(chartDate("2035-10-07T14:00:00Z", false), "Oct 7");
});
