import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFilters,
  serializeFilters,
} from "../features/jobs/filter-jobs.ts";
import { apiJobsQuery, pageNumbers } from "../lib/api-query.ts";
test("URL state round trips with repeated technologies", () => {
  const filters = parseFilters(
    new URLSearchParams(
      "q=React&category=Frontend&location=Spain&tech=React&tech=TypeScript&page=2&posted=7&sort=oldest",
    ),
  );
  assert.deepEqual(parseFilters(serializeFilters(filters)), filters);
});
test("invalid URL input is normalized to API limits", () => {
  const filters = parseFilters(
    new URLSearchParams(
      "category=invalid&salaryMin=999999999&posted=5&sort=bad&page=999999&tech=React&tech=React&tech=Fake",
    ),
  );
  assert.equal(filters.category, "");
  assert.equal(filters.salaryMin, "");
  assert.equal(filters.page, 10000);
  assert.equal(filters.sort, "newest");
  assert.deepEqual(filters.tech, ["React"]);
});
test("UI query maps to backend contract without leaking UI keys", () => {
  const query = apiJobsQuery(
    parseFilters(
      new URLSearchParams(
        "q=Node&location=Spain&workType=Remote&tech=React&tech=TypeScript&salaryMin=90000&sort=salary-high&page=2",
      ),
    ),
  );
  assert.equal(query.get("search"), "Node");
  assert.equal(query.get("location"), "Spain");
  assert.equal(query.get("remoteType"), "REMOTE");
  assert.equal(query.get("technologies"), "React,TypeScript");
  assert.equal(query.get("currency"), "USD");
  assert.equal(query.get("limit"), "8");
  assert.equal(query.get("page"), "2");
  assert.equal(query.has("q"), false);
  assert.equal(query.has("tech"), false);
});
test("pagination remains compact for hundreds of pages", () => {
  assert.deepEqual(pageNumbers(1, 108), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageNumbers(54, 108), [52, 53, 54, 55, 56]);
  assert.deepEqual(pageNumbers(108, 108), [104, 105, 106, 107, 108]);
  assert.deepEqual(pageNumbers(1, 1), [1]);
});
