import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFilters,
  serializeFilters,
} from "../features/jobs/filter-jobs.ts";
import { apiJobsQuery, pageNumbers } from "../lib/api-query.ts";
import { supportsTechnologyFilter } from "../features/jobs/types.ts";
test("URL state round trips with repeated technologies", () => {
  const filters = parseFilters(
    new URLSearchParams(
      "q=React&category=Frontend&location=Spain&tech=React&tech=TypeScript&page=2&posted=7&sort=oldest&place=Madrid&companyName=Example&employmentKind=Full-time",
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
test("search defaults to relevance and preserves an explicit date sort", () => {
  const ranked = parseFilters(new URLSearchParams("q=Supplier+Relationship+Manager"));
  assert.equal(ranked.sort, "relevance");
  assert.equal(apiJobsQuery(ranked).has("sort"), false);
  assert.equal(parseFilters(serializeFilters(ranked)).sort, "relevance");
  const dated = parseFilters(new URLSearchParams("q=Supplier&sort=newest"));
  assert.equal(dated.sort, "newest");
  assert.equal(serializeFilters(dated).get("sort"), "newest");
  assert.equal(apiJobsQuery(dated).get("sort"), "newest");
});
test("technology filters apply only to technical job categories", () => {
  assert.equal(supportsTechnologyFilter(""), true);
  assert.equal(supportsTechnologyFilter("Frontend"), true);
  assert.equal(supportsTechnologyFilter("Logistics & Supply Chain"), false);
  const logistics = parseFilters(new URLSearchParams("category=Logistics+%26+Supply+Chain&tech=React"));
  assert.deepEqual(logistics.tech, []);
  assert.equal(apiJobsQuery(logistics).has("technologies"), false);
  assert.equal(serializeFilters(logistics).has("tech"), false);
  const frontend = parseFilters(new URLSearchParams("category=Frontend&tech=React"));
  assert.deepEqual(frontend.tech, ["React"]);
});
test("UI query maps to backend contract without leaking UI keys", () => {
  const query = apiJobsQuery(
    parseFilters(
      new URLSearchParams(
        "q=Node&location=Spain&workType=Remote&tech=React&tech=TypeScript&salaryMin=90000&sort=salary-high&page=2&place=Berlin&companyName=Acme&employmentKind=Contract",
      ),
    ),
  );
  assert.equal(query.get("search"), "Node");
  assert.equal(query.get("location"), "Spain");
  assert.equal(query.get("remoteType"), "REMOTE");
  assert.equal(query.get("technologies"), "React,TypeScript");
  assert.equal(query.get("place"), "Berlin");
  assert.equal(query.get("companyName"), "Acme");
  assert.equal(query.get("employmentKind"), "Contract");
  assert.equal(query.get("currency"), "USD");
  assert.equal(query.get("limit"), "9");
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
