import { test } from "node:test";
import assert from "node:assert/strict";
import { getMockJobs } from "../data/jobs.ts";
import {
  filterJobs,
  parseFilters,
  serializeFilters,
} from "../features/jobs/filter-jobs.ts";
import {
  categories,
  currencies,
  experiences,
  locations,
  technologies,
  workTypes,
} from "../features/jobs/types.ts";
const now = Date.parse("2026-10-03T12:00:00Z");
const jobs = getMockJobs(now);
const search = (query = "") =>
  filterJobs(jobs, parseFilters(new URLSearchParams(query)), now);

test("40 unique, complete listings cover all requested filter dimensions", () => {
  assert.equal(jobs.length, 40);
  assert.equal(new Set(jobs.map((job) => job.slug)).size, 40);
  for (const category of categories)
    assert.ok(
      jobs.some((job) => job.category === category),
      category,
    );
  for (const location of locations)
    assert.ok(
      jobs.some((job) => job.location === location),
      location,
    );
  for (const work of workTypes)
    assert.ok(
      jobs.some((job) => job.workType === work),
      work,
    );
  for (const experience of experiences)
    assert.ok(
      jobs.some((job) => job.experience === experience),
      experience,
    );
  for (const currency of currencies)
    assert.ok(
      jobs.some((job) => job.salary?.currency === currency),
      currency,
    );
  for (const tech of technologies)
    assert.ok(
      jobs.some((job) => job.technologies.includes(tech)),
      tech,
    );
  for (const job of jobs) {
    assert.ok(
      job.description.length && job.requirements.length && job.eligibility,
    );
    assert.ok(job.applyUrl.startsWith("https://"));
  }
});
test("search matches title, company, technologies and keywords, case-insensitively", () => {
  assert.ok(search("q=linear").every((job) => job.company.name === "Linear"));
  assert.ok(
    search("q=NeStJS").some((job) => job.technologies.includes("NestJS")),
  );
  assert.ok(search("q=frontend").every((job) => job.category === "Frontend"));
  assert.ok(search("q=accessible").length > 0);
  assert.equal(search("q=does-not-exist-123").length, 0);
  assert.ok(
    search("q=senior+react").every((job) =>
      `${job.title} ${job.technologies.join(" ")}`
        .toLowerCase()
        .includes("react"),
    ),
  );
});
test("country eligibility includes worldwide and applicable regions, excludes USA-only roles", () => {
  const spain = search("location=Spain");
  for (const region of ["Spain", "Europe", "EU", "Worldwide"])
    assert.ok(spain.some((job) => job.location === region));
  assert.ok(
    spain.every((job) => !["USA", "Germany", "UK"].includes(job.location)),
  );
  assert.ok(
    search("location=UK").every((job) =>
      ["UK", "Europe", "Worldwide"].includes(job.location),
    ),
  );
  assert.ok(
    search("location=Worldwide").every((job) => job.location === "Worldwide"),
  );
  assert.ok(search("location=EU").every((job) => job.location !== "UK"));
});
test("filters combine, and technology selection requires all selected technologies", () => {
  const results = search(
    "category=Frontend&workType=Remote&experience=Senior&tech=React&tech=TypeScript",
  );
  assert.ok(results.length > 0);
  assert.ok(
    results.every(
      (job) =>
        job.category === "Frontend" &&
        job.workType === "Remote" &&
        job.experience === "Senior" &&
        job.technologies.includes("React") &&
        job.technologies.includes("TypeScript"),
    ),
  );
});
test("posting windows use elapsed time; older listings remain available", () => {
  assert.equal(search("posted=1").length, 8);
  assert.equal(search("posted=3").length, 15);
  assert.equal(search("posted=7").length, 23);
  assert.equal(search("posted=30").length, 39);
  assert.equal(search().length, 40);
});
test("salary ranges overlap only in the selected currency; unlisted pay is excluded", () => {
  const results = search("salaryMin=100000&salaryMax=140000&currency=EUR");
  assert.ok(results.length > 0);
  assert.ok(
    results.every(
      (job) =>
        job.salary?.currency === "EUR" &&
        job.salary.max >= 100000 &&
        job.salary.min <= 140000,
    ),
  );
  assert.equal(search("salaryMin=150000&salaryMax=100000").length, 0);
  assert.ok(
    search("salaryMin=100000").every((job) => job.salary?.currency === "USD"),
  );
});
test("sorting is deterministic and salaries never compare different currencies", () => {
  assert.equal(search()[0].id, "job-1");
  assert.equal(search("sort=oldest")[0].id, "job-40");
  const high = search("sort=salary-high&currency=EUR");
  assert.ok(high.every((job) => job.salary?.currency === "EUR"));
  assert.ok(
    high.every(
      (job, i) => i === 0 || high[i - 1].salary!.max >= job.salary!.max,
    ),
  );
  const low = search("sort=salary-low");
  assert.ok(low.every((job) => job.salary?.currency === "USD"));
  assert.ok(
    low.every((job, i) => i === 0 || low[i - 1].salary!.min <= job.salary!.min),
  );
});
test("URL state round-trips and ignores invalid input", () => {
  const filters = parseFilters(
    new URLSearchParams(
      "q=React&category=Frontend&location=Spain&tech=React&tech=TypeScript&page=2&posted=7&sort=oldest",
    ),
  );
  assert.deepEqual(parseFilters(serializeFilters(filters)), filters);
  const invalid = parseFilters(
    new URLSearchParams(
      "category=invalid&salaryMin=-1&posted=5&sort=bad&page=-4&tech=React&tech=React&tech=Fake",
    ),
  );
  assert.equal(invalid.category, "");
  assert.equal(invalid.salaryMin, "");
  assert.equal(invalid.page, 1);
  assert.equal(invalid.sort, "newest");
  assert.deepEqual(invalid.tech, ["React"]);
});
