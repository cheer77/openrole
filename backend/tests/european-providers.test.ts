import { test } from "node:test";
import assert from "node:assert/strict";
import { SmartRecruitersProvider } from "../src/providers/smartrecruiters.js";
import {
  PersonioProvider,
  RecruiteeProvider,
} from "../src/providers/xml-providers.js";
import { validSourceIdentifier } from "../src/providers/source-config.js";

const detail = (id: string) => ({
  id,
  name: "Senior Backend Engineer",
  active: true,
  visibility: "PUBLIC",
  company: { identifier: "example" },
  postingUrl: `https://jobs.smartrecruiters.com/example/${id}`,
  applyUrl: `https://jobs.smartrecruiters.com/example/${id}?oga=true`,
  location: { city: "Madrid", country: "es", remote: false, hybrid: true },
  jobAd: {
    sections: {
      jobDescription: { title: "Role", text: "<p>Build Node.js APIs</p>" },
    },
  },
  releasedDate: "2026-10-01T10:00:00Z",
});
test("SmartRecruiters reads all pages and complete descriptions, respects pacing", async () => {
  const urls: string[] = [];
  let pauses = 0;
  const jobs = await new SmartRecruitersProvider(
    async (url) => {
      urls.push(url);
      const parsed = new URL(url);
      if (parsed.searchParams.has("offset")) {
        const offset = Number(parsed.searchParams.get("offset"));
        return {
          offset,
          totalFound: 101,
          content: Array.from({ length: offset ? 1 : 100 }, (_, i) => ({
            id: String(offset + i),
          })),
        };
      }
      return detail(parsed.pathname.split("/").pop()!);
    },
    async () => {
      pauses++;
    },
  ).fetch("example");
  assert.equal(jobs.length, 101);
  assert.equal(pauses, 103);
  assert.match(urls[1], /offset=100/);
  assert.equal(jobs[0].country, "ES");
  assert.equal(jobs[0].remoteType, "HYBRID");
  assert.match(jobs[0].description, /Build Node.js APIs/);
});
test("SmartRecruiters rejects incomplete/changing/duplicate snapshots and failed details", async () => {
  for (const page of [
    { offset: 0, totalFound: 1, content: [] },
    { offset: 1, totalFound: 0, content: [] },
    { offset: 0, totalFound: 2, content: [{ id: "1" }, { id: "1" }] },
  ])
    await assert.rejects(
      new SmartRecruitersProvider(
        async () => page,
        async () => {},
      ).fetch("example"),
    );
  for (const invalid of [
    { ...detail("1"), active: false },
    { ...detail("1"), company: { identifier: "other" } },
    { ...detail("1"), applyUrl: "javascript:alert(1)" },
  ]) {
    await assert.rejects(
      new SmartRecruitersProvider(
        async (url) =>
          url.includes("?limit")
            ? { offset: 0, totalFound: 1, content: [{ id: "1" }] }
            : invalid,
        async () => {},
      ).fetch("example"),
    );
  }
});

const position = `<position><id>123</id><name>Frontend Engineer</name><office>Berlin</office><additionalOffices><office>Munich</office></additionalOffices><jobDescriptions><jobDescription><name>Role</name><value><![CDATA[<p>React &amp; TypeScript</p>]]></value></jobDescription></jobDescriptions><createdAt>2026-01-01</createdAt></position>`;
test("Personio handles single/multiple jobs, CDATA, DE host and empty feeds", async () => {
  let requested = "";
  const jobs = await new PersonioProvider(async (url) => {
    requested = url;
    return `<workzag-jobs>${position}</workzag-jobs>`;
  }).fetch("de:example");
  assert.equal(requested, "https://example.jobs.personio.de/xml?language=en");
  assert.equal(jobs[0].description, "Role\n\nReact & TypeScript");
  assert.equal(jobs[0].location, "Berlin; Munich");
  assert.equal(jobs[0].publishedAt, null);
  assert.equal(
    jobs[0].applyUrl,
    "https://example.jobs.personio.de/job/123?language=en#apply",
  );
  assert.equal(
    (
      await new PersonioProvider(
        async () =>
          `<workzag-jobs>${position}${position.replace("123", "124")}</workzag-jobs>`,
      ).fetch("example")
    ).length,
    2,
  );
  assert.deepEqual(
    await new PersonioProvider(async () => "<workzag-jobs/>").fetch("example"),
    [],
  );
});
const offer = `<offer><id>01</id><title>Developer</title><description><![CDATA[<p>Build software</p>]]></description><country_code>nl</country_code><hybrid>true</hybrid><remote>false</remote><salary><min>70000</min><max>90000</max><currency>EUR</currency><period>year</period></salary><careers_url>https://example.com/job</careers_url><apply_url>https://example.com/apply</apply_url><published_at>2026-10-01 13:00:00 UTC</published_at></offer>`;
test("Recruitee XML preserves IDs, explicit geography, hybrid, annual pay and publication", async () => {
  const [job] = await new RecruiteeProvider(
    async () => `<offers>${offer}</offers>`,
  ).fetch("example");
  assert.equal(job.externalId, "01");
  assert.equal(job.country, "NL");
  assert.equal(job.remoteType, "HYBRID");
  assert.equal(job.salaryMin, 70000);
  assert.equal(job.publishedAt?.toISOString(), "2026-10-01T13:00:00.000Z");
  assert.deepEqual(
    await new RecruiteeProvider(async () => "<offers/>").fetch("example"),
    [],
  );
  const [encoded] = await new RecruiteeProvider(
    async () =>
      `<offers>${offer.replace("https://example.com/apply", "https://example.com/apply?one=1&amp;two=2")}</offers>`,
  ).fetch("example");
  assert.equal(encoded.applyUrl, "https://example.com/apply?one=1&two=2");
});
test("XML providers reject malformed/unknown/unsafe documents rather than reconcile empty", async () => {
  for (const xml of [
    "<html>error</html>",
    "<offers><error>denied</error></offers>",
    "<offers><offer></offers>",
    '<!DOCTYPE offers [<!ENTITY a "expansion">]><offers/>',
    `<offers>${offer.replace("https://example.com/apply", "javascript:alert(1)")}</offers>`,
  ]) {
    await assert.rejects(
      new RecruiteeProvider(async () => xml).fetch("example"),
    );
  }
});
test("identifier validation is provider-specific and cannot escape fixed hosts", () => {
  for (const [type, sourceIdentifier] of [
    ["PERSONIO", "de:company"],
    ["LEVER", "eu:company"],
    ["RECRUITEE", "my-company"],
  ])
    assert.ok(validSourceIdentifier({ type, sourceIdentifier }));
  for (const [type, sourceIdentifier] of [
    ["ASHBY", "eu:company"],
    ["PERSONIO", "eu:company"],
    ["RECRUITEE", "company.evil.com"],
    ["PERSONIO", "foo_bar"],
    ["SMARTRECRUITERS", "../../admin"],
    ["LEVER", "de:company"],
  ])
    assert.equal(validSourceIdentifier({ type, sourceIdentifier }), false);
});
