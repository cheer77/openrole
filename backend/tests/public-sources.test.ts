import { test } from "node:test";
import assert from "node:assert/strict";
import { USAJobsProvider } from "../src/providers/usajobs.js";
import { ArbeitnowProvider } from "../src/providers/arbeitnow.js";
import { CanadaJobBankProvider, csvRows } from "../src/providers/canada-job-bank.js";
import { validSourceIdentifier } from "../src/providers/source-config.js";
import { isTransientProviderError } from "../src/providers/http.js";

test("USAJOBS paginates official results and preserves federal employer and annual pay", async () => {
  const previous = [process.env.USAJOBS_API_KEY, process.env.USAJOBS_USER_AGENT];
  process.env.USAJOBS_API_KEY = "test-key";
  process.env.USAJOBS_USER_AGENT = "owner@example.com";
  const urls: string[] = [];
  try {
    const jobs = await new USAJobsProvider(async (url, headers) => {
      urls.push(url);
      assert.equal(headers["Authorization-Key"], "test-key");
      const page = Number(new URL(url).searchParams.get("Page"));
      return { SearchResult: { SearchResultCountAll: 2, SearchResultItems: [{
        MatchedObjectId: page,
        MatchedObjectDescriptor: {
          PositionTitle: "Software Engineer", PositionURI: `https://www.usajobs.gov/job/${page}`,
          ApplyURI: [`https://www.usajobs.gov/job/${page}/apply`],
          PositionLocationDisplay: "Washington, DC",
          PositionLocation: [{ CityName: "Washington", CountryCode: "United States" }],
          OrganizationName: "Department of Example", QualificationSummary: "Build public services",
          PublicationStartDate: "2026-10-01T00:00:00Z",
          PositionRemuneration: [{ MinimumRange: "80000", MaximumRange: "100000", RateIntervalCode: "PA" }],
          JobCategory: [{ Name: "Information Technology" }],
        },
      }] } };
    }).fetch("public");
    assert.equal(urls.length, 2);
    assert.equal(jobs[0]?.companyName, "Department of Example");
    assert.equal(jobs[0]?.salaryMin, 80000);
    assert.equal(jobs[0]?.country, "US");
    assert.deepEqual(jobs[0]?.sourceCategories, ["Information Technology"]);
  } finally {
    if (previous[0] === undefined) delete process.env.USAJOBS_API_KEY;
    else process.env.USAJOBS_API_KEY = previous[0];
    if (previous[1] === undefined) delete process.env.USAJOBS_USER_AGENT;
    else process.env.USAJOBS_USER_AGENT = previous[1];
  }
});

test("Arbeitnow follows verified next links, paces pages and rejects an incomplete page", async () => {
  const item = (id: string) => ({ slug: id, company_name: "Example GmbH", title: "Backend Engineer",
    description: "Build APIs with TypeScript", remote: true, url: `https://www.arbeitnow.com/view/${id}`,
    tags: ["TypeScript"], job_types: ["full_time"], location: "Berlin", created_at: 1780272000 });
  let pauses = 0;
  const jobs = await new ArbeitnowProvider(async (url) => ({
    data: [item(new URL(url).searchParams.get("page")!)],
    links: { next: url.endsWith("page=1") ? "https://www.arbeitnow.com/api/job-board-api?page=2" : null },
  }), async () => { pauses++; }).fetch("all");
  assert.equal(jobs.length, 2);
  assert.equal(pauses, 1);
  assert.equal(jobs[0]?.companyName, "Example GmbH");
  assert.equal(jobs[0]?.remoteType, "REMOTE");
  assert.deepEqual(jobs[0]?.technologies, ["TypeScript"]);
  await assert.rejects(new ArbeitnowProvider(async () => ({ data: [], links: { next: "https://www.arbeitnow.com/api/job-board-api?page=2" } })).fetch("all"));
});

test("Arbeitnow accepts its current page size above 100 without dropping jobs", async () => {
  const data = Array.from({ length: 325 }, (_, index) => ({
    slug: `job-${index}`, company_name: `Company ${index}`, title: "Engineer",
    description: "Build software", remote: false,
    url: `https://www.arbeitnow.com/jobs/job-${index}`,
  }));
  const jobs = await new ArbeitnowProvider(async () => ({ data, links: { next: null } })).fetch("all");
  assert.equal(jobs.length, 325);
  assert.equal(jobs[324]?.externalId, "job-324");
});

test("Arbeitnow skips overlapping page IDs but rejects a fully repeated page", async () => {
  const item = (slug: string) => ({
    slug, company_name: "Example GmbH", title: "Engineer",
    description: "Build software", remote: false,
    url: `https://www.arbeitnow.com/jobs/${slug}`,
  });
  const next = "https://www.arbeitnow.com/api/job-board-api?page=2";
  const jobs = await new ArbeitnowProvider(async (url) => ({
    data: url.endsWith("page=1") ? [item("one"), item("two")] : [item("two"), item("three")],
    links: { next: url.endsWith("page=1") ? next : null },
  }), async () => {}).fetch("all");
  assert.deepEqual(jobs.map((job) => job.externalId), ["one", "two", "three"]);

  await assert.rejects(new ArbeitnowProvider(async (url) => ({
    data: [item("one")], links: { next: url.endsWith("page=1") ? next : null },
  }), async () => {}).fetch("all"), /repeated a page/);
});

test("Canada CSV handles quoted fields but historical dataset cannot become active listings", async () => {
  async function* chunks() {
    yield Buffer.from('Job Title,City\n"Engineer, Senior","Mon');
    yield Buffer.from('tréal"\n');
  }
  const rows = [];
  for await (const row of csvRows(chunks())) rows.push(row);
  assert.deepEqual(rows[1], ["Engineer, Senior", "Montréal"]);
  const response = new Response("Job Title,City\nEngineer,Toronto\n", { status: 200 });
  await assert.rejects(new CanadaJobBankProvider(
    async () => ({ success: true, result: { resources: [{
      name: "September 2026 Job Postings Advertised on Canada's National Job Bank Website",
      url: "https://open.canada.ca/data/dataset/ea639e28-c0fc-48bf-b5dd-b8899bd43072/resource/test/download/job-bank-open-data-all-job-postings-en-sept2026.csv",
      format: "CSV", created: "2026-10-04",
    }] } }),
    async () => response,
  ).fetch("official-en"), /missing Job ID.*Apply URL.*Status/);
});

test("fixed aggregate identifiers reject arbitrary URLs and prefixes", () => {
  for (const [type, id] of [["USAJOBS", "public"], ["CANADA_JOB_BANK", "official-en"], ["ARBEITNOW", "all"]])
    assert.equal(validSourceIdentifier({ type, sourceIdentifier: id }), true);
  for (const type of ["USAJOBS", "CANADA_JOB_BANK", "ARBEITNOW"])
    assert.equal(validSourceIdentifier({ type, sourceIdentifier: "https://example.com" }), false);
});

test("rate limits and provider outages remain retryable without disabling the source", () => {
  assert.equal(isTransientProviderError(new Error("Provider HTTP 429")), true);
  assert.equal(isTransientProviderError(new Error("Provider HTTP 503")), true);
  assert.equal(isTransientProviderError(new Error("Provider HTTP 404")), false);
  assert.equal(isTransientProviderError(new Error("Invalid identifier for this provider")), false);
});
