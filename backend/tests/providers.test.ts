import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GreenhouseProvider,
  LeverProvider,
  AshbyProvider,
} from "../src/providers/providers.js";
import { normalize, plainText } from "../src/providers/normalize.js";
import { jobsQuery } from "../src/jobs-query.js";
import { jobSlug } from "../src/sync.js";

const raw = {
  externalId: "1",
  title: "Senior Frontend Engineer",
  description: "<p>Use React, TypeScript &amp; Docker.</p>",
  sourceUrl: "https://example.com/job",
  applyUrl: "https://example.com/apply",
};

test("normalization cleans HTML, classifies role, preserves unknown geography and dates", () => {
  const job = normalize(raw);
  assert.equal(job.category, "Frontend");
  assert.equal(job.experienceLevel, "Senior");
  assert.deepEqual(job.technologies, ["React", "TypeScript", "Docker"]);
  assert.equal(job.publishedAt, null);
  assert.equal(job.remoteType, "UNKNOWN");
  assert.equal(job.country, null);
  assert.equal(
    plainText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;"),
    "Hello & welcome",
  );
});

test("only structured annual compensation is comparable", () => {
  assert.equal(
    normalize({
      ...raw,
      salary: { min: 50, currency: "USD", interval: "hour" },
    }).salaryMin,
    null,
  );
  assert.equal(
    normalize({
      ...raw,
      salary: { min: 50000, currency: "EUR", interval: "year" },
    }).salaryMin,
    50000,
  );
  assert.throws(() => normalize({ ...raw, applyUrl: "javascript:alert(1)" }));
  assert.throws(() =>
    normalize({
      ...raw,
      salary: { min: 90, max: 80, currency: "EUR", interval: "year" },
    }),
  );
});

test("Greenhouse checks complete response and does not treat updated_at as publication", async () => {
  const item = {
    id: 10,
    internal_job_id: 10,
    title: raw.title,
    content: raw.description,
    absolute_url: raw.applyUrl,
    location: { name: "Remote" },
    updated_at: "2026-01-01T00:00:00Z",
  };
  const jobs = await new GreenhouseProvider(async () => ({
    jobs: [item],
    meta: { total: 1 },
  })).fetch("example");
  assert.equal(jobs[0].publishedAt, null);
  assert.equal(jobs[0].remoteType, "REMOTE");
  await assert.rejects(
    new GreenhouseProvider(async () => ({
      jobs: [item],
      meta: { total: 2 },
    })).fetch("example"),
  );
  await assert.rejects(
    new GreenhouseProvider(async () => ({ jobs: [] })).fetch("example"),
  );
});

test("Lever retrieves all pages and supports EU instances", async () => {
  const urls: string[] = [];
  const provider = new LeverProvider(async (url) => {
    urls.push(url);
    if (urls.length === 2) return [];
    return Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      text: raw.title,
      descriptionPlain: "Build APIs",
      hostedUrl: raw.sourceUrl,
      applyUrl: raw.applyUrl,
      categories: { location: "Madrid" },
      workplaceType: "hybrid",
    }));
  });
  const jobs = await provider.fetch("eu:example");
  assert.equal(jobs.length, 100);
  assert.equal(jobs[0].remoteType, "HYBRID");
  assert.match(urls[1], /api\.lever\.eu.*skip=100/);
});

test("Ashby ignores unlisted positions and preserves explicit country, date, salary", async () => {
  const item = {
    title: raw.title,
    isListed: true,
    descriptionPlain: "Work on React",
    jobUrl: "https://jobs.ashbyhq.com/example/external-id",
    applyUrl: raw.applyUrl,
    publishedAt: "2026-01-01T12:00:00Z",
    workplaceType: "Remote",
    address: {
      postalAddress: { addressCountry: "Spain", addressLocality: "Madrid" },
    },
    compensation: {
      summaryComponents: [
        {
          compensationType: "Salary",
          interval: "1 YEAR",
          currencyCode: "EUR",
          minValue: 70000,
          maxValue: 90000,
        },
      ],
    },
  };
  const withEquity = {
    ...item,
    compensation: {
      summaryComponents: [
        ...item.compensation.summaryComponents,
        {
          compensationType: "EquityPercentage",
          interval: "NONE",
          minValue: 0.1,
          maxValue: 1,
        },
      ],
    },
  };
  const jobs = await new AshbyProvider(async () => ({
    jobs: [withEquity, { ...item, isListed: false }],
  })).fetch("example");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].externalId, "external-id");
  assert.equal(jobs[0].country, "ES");
  assert.equal(jobs[0].salaryMax, 90000);
  assert.equal(jobs[0].publishedAt?.toISOString(), "2026-01-01T12:00:00.000Z");
});

test("source identifiers cannot change provider host or path", async () => {
  await assert.rejects(
    new GreenhouseProvider(async () => {
      throw new Error("must not fetch");
    }).fetch("../../bad"),
  );
});

test("large multi-location boards keep all locations and Ashby null workplace stays unknown", async () => {
  const location = Array.from(
    { length: 60 },
    (_, i) => `Office ${i}, Germany`,
  ).join("; ");
  assert.equal(normalize({ ...raw, location }).location, location);
  const [job] = await new AshbyProvider(async () => ({
    jobs: [
      {
        id: "nullable",
        title: raw.title,
        isListed: true,
        isRemote: null,
        workplaceType: null,
        address: null,
        descriptionPlain: "Build software",
        jobUrl: raw.sourceUrl,
        applyUrl: raw.applyUrl,
      },
    ],
  })).fetch("example");
  assert.equal(job.remoteType, "UNKNOWN");
});

test("query validation bounds pagination and uses one currency for salary comparisons", () => {
  assert.throws(() => jobsQuery({ limit: "1000" }));
  assert.throws(() => jobsQuery({ page: "-1" }));
  assert.throws(() => jobsQuery({ salaryMin: "200", salaryMax: "100" }));
  assert.throws(() => jobsQuery({ unexpected: "x" }));
  const result = jobsQuery(
    {
      sort: "salary-high",
      technologies: "React,TypeScript,React",
      posted: "1",
    },
    new Date("2026-01-02T00:00:00Z"),
  );
  assert.equal(result.currency, "USD");
  assert.deepEqual(result.query.technologies, ["React", "TypeScript"]);
  assert.deepEqual(result.where.sortDate, {
    gte: new Date("2026-01-01T00:00:00Z"),
  });
});

test("job slugs separate sources and remain deterministic", () => {
  assert.equal(
    jobSlug("Développeur React", "one", "1"),
    jobSlug("Développeur React", "one", "1"),
  );
  assert.notEqual(
    jobSlug("Developer", "one", "1"),
    jobSlug("Developer", "two", "1"),
  );
});
