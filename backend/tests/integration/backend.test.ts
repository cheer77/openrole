import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { normalize } from "../../src/providers/normalize.js";
import { syncSource } from "../../src/sync.js";
import { cleanupClosedJobs } from "../../src/cleanup.js";
import { reclassifyJobs } from "../../src/jobs/reclassify.js";
import {
  clearLeverPublishedAt,
  parseCleanupOptions,
} from "../../src/jobs/clear-lever-published-at.js";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must name a dedicated *_test database");
process.env.DATABASE_URL = testUrl;
const { createDb } = await import("../../src/db.js");
const { createApp } = await import("../../src/app.js");

test("PostgreSQL synchronization and API regression", async (t) => {
  const db = createDb(testUrl);
  const uid = randomUUID();
  const company = await db.company.create({
    data: { name: `Integration ${uid}`, slug: `integration-${uid}` },
  });
  const source = await db.source.create({
    data: {
      name: "Test board",
      type: "ASHBY",
      sourceIdentifier: uid,
      companyId: company.id,
      enabled: true,
    },
  });
  const start = new Date("2026-01-01T12:00:00Z");
  const original = normalize({
    externalId: "one",
    title: "Senior Frontend Developer",
    description: "React TypeScript APIs",
    location: "Madrid",
    country: "Spain",
    workplace: "Remote",
    sourceUrl: "https://example.com/one",
    applyUrl: "https://example.com/one/apply",
    salary: { min: 60000, max: 80000, currency: "EUR", interval: "year" },
  });
  let items = [original];
  const provider = { fetch: async () => items };
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  try {
    await t.test(
      "initial import, idempotent update, stable slug and firstSeenAt",
      async () => {
        assert.deepEqual(await syncSource(db, source.id, provider, start), {
          found: 1,
          created: 1,
          updated: 0,
          closed: 0,
        });
        const before = await db.job.findFirstOrThrow({
          where: { sourceId: source.id },
        });
        assert.equal(before.contentUpdatedAt?.toISOString(), start.toISOString());
        const unchangedAt = new Date(start.getTime() + 1800000);
        await syncSource(db, source.id, provider, unchangedAt);
        const unchanged = await db.job.findFirstOrThrow({ where: { sourceId: source.id } });
        assert.equal(unchanged.contentUpdatedAt?.toISOString(), start.toISOString());
        assert.equal(unchanged.lastCheckedAt.toISOString(), unchangedAt.toISOString());
        items = [{ ...original, title: "Senior Frontend Engineer" }];
        await syncSource(
          db,
          source.id,
          provider,
          new Date(start.getTime() + 3600000),
        );
        const after = await db.job.findFirstOrThrow({
          where: { sourceId: source.id },
        });
        assert.equal(after.slug, before.slug);
        assert.equal(after.contentUpdatedAt?.toISOString(), new Date(start.getTime() + 3600000).toISOString());
        assert.equal(after.firstSeenAt.toISOString(), start.toISOString());
        assert.equal(after.publishedAt, null);
        assert.equal(after.sortDate.toISOString(), start.toISOString());
        assert.equal(after.lastSeenAt?.toISOString(), new Date(start.getTime() + 3600000).toISOString());
        assert.equal(after.missingCount, 0);
        assert.equal(await db.job.count({ where: { sourceId: source.id } }), 1);

        // Simulate a legacy row migrated without a trustworthy content date.
        await db.job.update({ where: { id: after.id }, data: { contentUpdatedAt: null } });
        await syncSource(db, source.id, provider, new Date(start.getTime() + 7200000));
        assert.equal((await db.job.findUniqueOrThrow({ where: { id: after.id } })).contentUpdatedAt, null);
        items = [{ ...items[0]!, description: "React TypeScript APIs with updated responsibilities" }];
        await syncSource(db, source.id, provider, new Date(start.getTime() + 10800000));
        assert.equal(
          (await db.job.findUniqueOrThrow({ where: { id: after.id } })).contentUpdatedAt?.toISOString(),
          new Date(start.getTime() + 10800000).toISOString(),
        );
      },
    );

    await t.test("Lever cleanup changes only non-manual Lever dates", async () => {
      const cleanupCompany = await db.company.create({
        data: { name: `Cleanup ${uid}`, slug: `cleanup-${uid}` },
      });
      const [leverSource, ashbySource] = await Promise.all([
        db.source.create({ data: {
          name: "Cleanup Lever", type: "LEVER", sourceIdentifier: `cleanup-${uid}`,
          companyId: cleanupCompany.id, enabled: true,
        } }),
        db.source.create({ data: {
          name: "Cleanup Ashby", type: "ASHBY", sourceIdentifier: `cleanup-${uid}`,
          companyId: cleanupCompany.id, enabled: true,
        } }),
      ]);
      const firstSeenAt = new Date("2026-01-02T00:00:00Z");
      const legacyDate = new Date("2025-01-01T00:00:00Z");
      const originalContentDate = new Date("2026-01-03T00:00:00Z");
      const cleanupAt = new Date("2026-01-04T00:00:00Z");
      const row = (externalId: string, sourceId: string, manualOverride = false) => ({
        externalId, slug: `${externalId}-${uid}`, title: "Cleanup test role",
        companyId: cleanupCompany.id, sourceId, description: "A vacancy",
        shortDescription: "A vacancy", category: "Other", location: "Remote",
        sourceUrl: `https://example.com/${externalId}`,
        applyUrl: `https://example.com/${externalId}/apply`,
        publishedAt: legacyDate, firstSeenAt, lastCheckedAt: firstSeenAt,
        sortDate: legacyDate, contentUpdatedAt: originalContentDate, manualOverride,
      });
      try {
        await db.job.createMany({ data: [
          row("lever-imported", leverSource.id),
          row("lever-manual", leverSource.id, true),
          row("ashby-imported", ashbySource.id),
        ] });
        const preview = await clearLeverPublishedAt(db, parseCleanupOptions([]), cleanupAt);
        assert.equal(preview.mode, "dry-run");
        assert.equal(preview.count, 1);
        assert.equal(preview.manualOverridesExcluded, 1);
        const result = await clearLeverPublishedAt(db, parseCleanupOptions([
          "--apply", `--confirm-database=${preview.database}`, `--confirm-count=${preview.count}`,
        ]), cleanupAt);
        if (result.mode !== "apply") throw new Error("Cleanup did not apply");
        assert.equal(result.updated, 1);
        const jobs = new Map((await db.job.findMany({
          where: { companyId: cleanupCompany.id },
        })).map((job) => [job.externalId, job]));
        assert.equal(jobs.get("lever-imported")?.publishedAt, null);
        assert.equal(jobs.get("lever-imported")?.sortDate.toISOString(), firstSeenAt.toISOString());
        assert.equal(jobs.get("lever-imported")?.contentUpdatedAt?.toISOString(), cleanupAt.toISOString());
        for (const externalId of ["lever-manual", "ashby-imported"]) {
          assert.equal(jobs.get(externalId)?.publishedAt?.toISOString(), legacyDate.toISOString());
          assert.equal(jobs.get(externalId)?.sortDate.toISOString(), legacyDate.toISOString());
          assert.equal(jobs.get(externalId)?.contentUpdatedAt?.toISOString(), originalContentDate.toISOString());
        }
      } finally {
        await db.job.deleteMany({ where: { companyId: cleanupCompany.id } });
        await db.source.deleteMany({ where: { companyId: cleanupCompany.id } });
        await db.company.delete({ where: { id: cleanupCompany.id } });
      }
      assert.equal(await db.job.count({ where: { sourceId: source.id } }), 1);
      assert.equal((await db.source.findUniqueOrThrow({ where: { id: source.id } })).enabled, true);
      assert.equal((await db.company.findUniqueOrThrow({ where: { id: company.id } })).enabled, true);
    });

    await t.test(
      "API searches, filters, pagination and validation",
      async () => {
        const imported = await db.job.findFirstOrThrow({ where: { sourceId: source.id } });
        await db.job.update({ where: { id: imported.id }, data: {
          category: "Other", categoryVersion: 0, employmentKind: null, employmentType: "Full-time",
        } });
        assert.equal((await reclassifyJobs(db)).changed >= 1, true);
        const reclassified = await db.job.findUniqueOrThrow({ where: { id: imported.id } });
        assert.equal(reclassified.category, "Frontend");
        assert.equal(reclassified.categoryVersion, 1);
        assert.equal(reclassified.employmentKind, "Full-time");
        const response = await fetch(
          `${base}/jobs?search=Frontend&country=ES&remoteType=REMOTE&technologies=React,TypeScript&salaryMin=70000&currency=EUR&employmentKind=Full-time&place=Madrid&companyName=Integration&limit=1`,
        );
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.total, 1);
        assert.equal(body.items.length, 1);
        assert.equal((await (await fetch(`${base}/jobs?place=Spain&search=${encodeURIComponent(uid)}`)).json()).total, 1);
        for (const location of ["Spain", "Europe", "EU"]) {
          const geographic = await (
            await fetch(
              `${base}/jobs?search=${encodeURIComponent(uid)}&location=${location}`,
            )
          ).json();
          assert.equal(geographic.total, 1);
        }
        const worldwide = await (
          await fetch(
            `${base}/jobs?search=${encodeURIComponent(uid)}&location=Worldwide`,
          )
        ).json();
        assert.equal(
          worldwide.total,
          0,
          "Remote in Madrid must not imply worldwide eligibility",
        );
        await db.job.update({ where: { id: body.items[0].id }, data: { country: null, region: null, location: '' } });
        const unknown = await (await fetch(`${base}/jobs?search=${encodeURIComponent(uid)}&location=Other`)).json();
        assert.equal(unknown.total, 1, 'Other includes an unknown location');
        await db.job.update({ where: { id: body.items[0].id }, data: { country: 'ES', location: 'Madrid' } });
        assert.equal(body.items[0].description, undefined);
        assert.equal(
          (await fetch(`${base}/jobs/${body.items[0].slug}`)).status,
          200,
        );
        assert.equal((await fetch(`${base}/jobs?limit=999`)).status, 400);
        assert.equal((await fetch(`${base}/jobs?salaryMin=abc`)).status, 400);
        assert.equal((await fetch(`${base}/jobs/missing-job`)).status, 404);
        const companies = await (
          await fetch(`${base}/companies?search=${encodeURIComponent(uid)}`)
        ).json();
        assert.equal(companies.items[0]._count.jobs, 1);
        assert.equal((await fetch(`${base}/health`)).status, 200);
      },
    );

    await t.test("search ranks title coverage above broad and description matches", async () => {
      const titles = [
        "Supplier Relationship Manager", "Senior Supplier Relationship Manager",
        "Supplier Manager", "Supply Chain Program Manager", "Frontend Developer",
        "Backend Developer", "Software Engineer", "Registered Nurse",
        "React Developer", "React Project Manager", "Java Developer", "Developer", "AI Engineer",
      ];
      await db.job.createMany({ data: titles.map((title, index) => ({
        externalId: `ranking-${index}`, slug: `ranking-${index}-${uid}`,
        title, companyId: company.id, sourceId: source.id,
        description: index === 6 ? "Nurse Frontend Supplier Relationship Manager React Developer" : "A vacancy",
        shortDescription: "A vacancy", category: "Other", location: "Madrid", country: "ES",
        sourceUrl: `https://example.com/ranking-${index}`, applyUrl: `https://example.com/ranking-${index}`,
        lastCheckedAt: new Date(), sortDate: new Date(Date.now() - index * 1000),
      })) });
      try {
      const ranked = async (search: string) => {
        const response = await fetch(`${base}/jobs?search=${encodeURIComponent(search)}&company=${company.slug}&limit=30`);
        assert.equal(response.status, 200);
        return (await response.json()).items.map((job: { title: string }) => job.title);
      };
      const supplier = await ranked("Supplier Relationship Manager");
      assert.equal(supplier[0], "Supplier Relationship Manager");
      assert.ok(supplier.indexOf("Supplier Manager") < supplier.indexOf("Supply Chain Program Manager"));
      const frontend = await ranked("Frontend Developer");
      assert.ok(frontend.indexOf("Frontend Developer") < frontend.indexOf("Backend Developer"));
      assert.ok(frontend.indexOf("Frontend Developer") < frontend.indexOf("Software Engineer"));
      const nurse = await ranked("Nurse");
      assert.ok(nurse.indexOf("Registered Nurse") < nurse.indexOf("Software Engineer"));
      const react = await ranked("React Developer");
      assert.ok(react.indexOf("React Developer") < react.indexOf("Java Developer"));
      assert.ok(react.indexOf("React Developer") < react.indexOf("React Project Manager"));
      assert.ok((await ranked("Suppli Relationship Manager")).includes("Supplier Relationship Manager"));
      assert.ok((await ranked("AI")).includes("AI Engineer"));
      const oldest = await fetch(`${base}/jobs?search=Supplier&company=${company.slug}&sort=oldest&limit=30`);
      assert.equal(oldest.status, 200);
      assert.notEqual((await oldest.json()).items[0].title, "Supplier Relationship Manager");
      } finally {
        await db.job.deleteMany({ where: { sourceId: source.id, externalId: { startsWith: "ranking-" } } });
      }
    });

    await t.test("company catalog searches globally and sorts active counts before pagination", async () => {
      const names = ["Alpha", "Beta"];
      const companies = await Promise.all(names.map((name) => db.company.create({
        data: { name: `Catalog ${uid} ${name}`, slug: `catalog-${uid}-${name.toLowerCase()}` },
      })));
      const sources = await Promise.all(companies.map((item, index) => db.source.create({
        data: { name: `Catalog board ${index}`, type: "ASHBY", sourceIdentifier: `catalog-${uid}-${index}`, companyId: item.id, enabled: true },
      })));
      try {
        await db.job.createMany({ data: [0, 1, 2].map((index) => ({
          externalId: `catalog-${index}`, slug: `catalog-${uid}-${index}`,
          title: `Catalog role ${index}`, companyId: companies[index === 0 ? 0 : 1].id,
          sourceId: sources[index === 0 ? 0 : 1].id, description: "A vacancy", shortDescription: "A vacancy",
          category: "Other", location: "Madrid", sourceUrl: `https://example.com/catalog-${index}`,
          applyUrl: `https://example.com/catalog-${index}`, lastCheckedAt: new Date(), sortDate: new Date(),
        })) });
        const query = async (sort: string, page = 1) => {
          const response = await fetch(`${base}/companies?search=${encodeURIComponent(`catalog ${uid}`)}&sort=${sort}&limit=1&page=${page}`);
          assert.equal(response.status, 200);
          return response.json();
        };
        const featured = await query("featured");
        assert.equal(featured.total, 2);
        assert.equal(featured.items[0].name, `Catalog ${uid} Beta`);
        assert.equal(featured.items[0]._count.jobs, 2);
        assert.equal((await query("featured", 2)).items[0].name, `Catalog ${uid} Alpha`);
        assert.equal((await query("name")).items[0].name, `Catalog ${uid} Alpha`);
        assert.equal((await query("nameDesc")).items[0].name, `Catalog ${uid} Beta`);
      } finally {
        await db.job.deleteMany({ where: { companyId: { in: companies.map((item) => item.id) } } });
        await db.source.deleteMany({ where: { id: { in: sources.map((item) => item.id) } } });
        await db.company.deleteMany({ where: { id: { in: companies.map((item) => item.id) } } });
      }
    });

    await t.test(
      "failed or duplicate snapshots never advance absence tracking",
      async () => {
        await assert.rejects(
          syncSource(
            db,
            source.id,
            {
              fetch: async () => {
                throw new Error("Provider HTTP 503");
              },
            },
            new Date(start.getTime() + 7200000),
          ),
        );
        assert.equal(
          (await db.job.findFirstOrThrow({ where: { sourceId: source.id } }))
            .missingSince,
          null,
        );
        assert.equal((await db.job.findFirstOrThrow({ where: { sourceId: source.id } })).missingCount, 0);
        await assert.rejects(
          syncSource(
            db,
            source.id,
            { fetch: async () => [original, original] },
            new Date(start.getTime() + 7200000),
          ),
        );
        assert.equal(
          (await db.job.findFirstOrThrow({ where: { sourceId: source.id } }))
            .status,
          "ACTIVE",
        );
      },
    );

    await t.test(
      "three successful misses close after 24h; cleanup preserves analytics; reappearance restores URL",
      async () => {
        items = [];
        const absent = new Date(start.getTime() + 86400000);
        await syncSource(db, source.id, provider, absent);
        assert.equal((await db.job.findFirstOrThrow({ where: { sourceId: source.id } })).missingCount, 1);
        await syncSource(
          db,
          source.id,
          provider,
          new Date(absent.getTime() + 3600000),
        );
        assert.equal(
          (await db.job.findFirstOrThrow({ where: { sourceId: source.id } }))
            .status,
          "ACTIVE",
        );
        assert.equal((await db.job.findFirstOrThrow({ where: { sourceId: source.id } })).missingCount, 2);
        await syncSource(
          db,
          source.id,
          provider,
          new Date(absent.getTime() + 86400000),
        );
        const job = await db.job.findFirstOrThrow({
          where: { sourceId: source.id },
        });
        assert.equal(job.status, "CLOSED");
        assert.equal(job.missingCount, 3);
        assert.ok(job.closedAt);
        assert.equal((await fetch(`${base}/jobs/${job.slug}`)).status, 200);
        assert.equal((await (await fetch(`${base}/jobs/${job.slug}`)).json()).status, "CLOSED");
        assert.equal((await (await fetch(`${base}/jobs?search=Frontend`)).json()).items.some((item: { id: string }) => item.id === job.id), false);
        assert.equal((await (await fetch(`${base}/seo/jobs?offset=0&limit=5000`)).json()).some((item: { slug: string }) => item.slug === job.slug), false);
        const eventId = randomUUID();
        await db.analyticsEvent.create({ data: {
          id: eventId, type: "JOB_VIEW", visitorId: randomUUID(), sessionId: randomUUID(),
          path: `/jobs/${job.slug}`, jobId: job.id, trafficSource: "Direct",
          device: "Desktop", browser: "Other", os: "Other",
        } });
        assert.equal((await cleanupClosedJobs(db, new Date(job.closedAt!.getTime() + 29 * 86400000))).removed, 0);
        assert.equal((await cleanupClosedJobs(db, new Date(job.closedAt!.getTime() + 31 * 86400000))).removed, 1);
        assert.equal((await fetch(`${base}/jobs/${job.slug}`)).status, 410);
        assert.equal(await db.analyticsEvent.count({ where: { id: eventId } }), 1);
        assert.equal((await db.expiredJob.findUniqueOrThrow({ where: { id: job.id } })).title, job.title);
        items = [original];
        await syncSource(
          db,
          source.id,
          provider,
          new Date(job.closedAt!.getTime() + 32 * 86400000),
        );
        const returned = await db.job.findFirstOrThrow({ where: { sourceId: source.id } });
        assert.equal(returned.status, "ACTIVE");
        assert.equal(returned.slug, job.slug);
        assert.equal(returned.missingCount, 0);
        await db.analyticsEvent.delete({ where: { id: eventId } });
      },
    );

    await t.test(
      "a concurrent sync of the same source is skipped while its transaction holds the lock",
      async () => {
        let release!: () => void;
        let entered!: () => void;
        const blocked = new Promise<void>((resolve) => {
          release = resolve;
        });
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const first = syncSource(db, source.id, {
          fetch: async () => {
            entered();
            await blocked;
            return [original];
          },
        });
        await started;
        try {
          assert.deepEqual(await syncSource(db, source.id, provider), {
            skipped: true,
          });
        } finally {
          release();
          await first;
        }
      },
    );

    await t.test("source HTML reaches detail API while listing and search keep plain text", async () => {
      const sourceMarkup = '<h2>Responsibilities</h2><ul><li>Build APIs</li></ul>';
      items = [{ ...original, descriptionHtml: sourceMarkup }];
      await syncSource(db, source.id, provider);
      const job = await db.job.findFirstOrThrow({ where: { sourceId: source.id } });
      const detail = await (await fetch(`${base}/jobs/${job.slug}`)).json();
      assert.equal(detail.descriptionHtml, sourceMarkup);
      assert.equal(detail.description, original.description);
      const listing = await (await fetch(`${base}/jobs?search=React`)).json();
      assert.equal(listing.items.find((item: { id: string }) => item.id === job.id)?.descriptionHtml, undefined);
      items = [original];
      await syncSource(db, source.id, provider);
    });

    await t.test(
      "companies from aggregate jobs appear publicly without owning a source",
      async () => {
        const aggregate = await db.company.create({ data: {
          name: `Aggregate ${uid}`, slug: `aggregate-${uid}`,
        } });
        const employerName = `Employer ${uid}`;
        const aggregateSource = await db.source.create({ data: {
          name: "Aggregate board", type: "ASHBY",
          sourceIdentifier: `aggregate-${uid}`, companyId: aggregate.id, enabled: true,
        } });
        try {
          await syncSource(db, aggregateSource.id, { fetch: async () => [{
            ...original, externalId: "employer-job", companyName: null,
          }] });
          const before = await db.job.findFirstOrThrow({ where: { sourceId: aggregateSource.id } });
          assert.equal(before.companyId, aggregate.id);
          await syncSource(db, aggregateSource.id, { fetch: async () => [{
            ...original, externalId: "employer-job", companyName: employerName,
          }] });
          const employer = await db.company.findFirstOrThrow({ where: { name: employerName } });
          const reassigned = await db.job.findFirstOrThrow({ where: { sourceId: aggregateSource.id } });
          assert.equal(reassigned.companyId, employer.id);
          assert.equal(reassigned.slug, before.slug);
          assert.equal(await db.source.count({ where: { companyId: employer.id } }), 0);
          const listed = await (await fetch(`${base}/companies?search=${encodeURIComponent(employerName)}`)).json();
          assert.equal(listed.total, 1);
          assert.equal(listed.items[0].slug, employer.slug);
          assert.equal(listed.items[0]._count.jobs, 1);
          await db.source.update({ where: { id: aggregateSource.id }, data: { enabled: false } });
          const hidden = await (await fetch(`${base}/companies?search=${encodeURIComponent(employerName)}`)).json();
          assert.equal(hidden.total, 0);
        } finally {
          await db.job.deleteMany({ where: { sourceId: aggregateSource.id } });
          await db.source.delete({ where: { id: aggregateSource.id } });
          await db.company.deleteMany({ where: { name: employerName } });
          await db.company.delete({ where: { id: aggregate.id } });
        }
      },
    );

    await t.test(
      "hidden jobs and disabled sources stay out of public results",
      async () => {
        const job = await db.job.findFirstOrThrow({
          where: { sourceId: source.id },
        });
        await db.job.update({
          where: { id: job.id },
          data: { status: "HIDDEN", statusOverride: true },
        });
        await syncSource(db, source.id, provider);
        assert.equal(
          (await db.job.findUniqueOrThrow({ where: { id: job.id } })).status,
          "HIDDEN",
        );
        assert.equal((await fetch(`${base}/jobs/${job.slug}`)).status, 404);
        await db.job.update({
          where: { id: job.id },
          data: { status: "ACTIVE" },
        });
        await db.source.update({
          where: { id: source.id },
          data: { enabled: false },
        });
        assert.deepEqual(await syncSource(db, source.id, provider), {
          skipped: true,
        });
        assert.equal((await fetch(`${base}/jobs/${job.slug}`)).status, 404);
      },
    );

    await t.test("new jobs automatically enter SEO feeds and eligible company/category counts", async () => {
      const seoCompany = await db.company.create({ data: { name: `SEO ${uid}`, slug: `seo-${uid}` } });
      const seoSource = await db.source.create({ data: {
        name: "SEO board", type: "ASHBY", sourceIdentifier: `seo-${uid}`,
        companyId: seoCompany.id, enabled: true,
      } });
      try {
        const postings = Array.from({ length: 5 }, (_, index) => normalize({
          ...original,
          descriptionHtml: original.descriptionHtml ?? undefined,
          publishedAt: original.publishedAt?.toISOString() ?? null,
          externalId: `seo-${index}`,
          title: `Frontend Engineer ${index}`,
          city: "Madrid",
        }));
        await syncSource(db, seoSource.id, { fetch: async () => postings });
        const saved = await db.job.findMany({ where: { sourceId: seoSource.id } });
        assert.equal(saved.length, 5);
        assert.match(saved[0].slug, new RegExp(`seo-${uid}-madrid`));
        const summary = await (await fetch(`${base}/seo/summary`)).json();
        assert.ok(summary.categories.find((item: { name: string }) => item.name === "Frontend").count >= 5);
        assert.ok(summary.companies >= 1);
        const jobs = await (await fetch(`${base}/seo/jobs?offset=0&limit=5000`)).json();
        const sitemapJob = jobs.find((item: { slug: string }) => item.slug === saved[0].slug);
        assert.ok(sitemapJob);
        assert.equal(sitemapJob.contentUpdatedAt, saved[0].contentUpdatedAt?.toISOString());
        assert.equal("updatedAt" in sitemapJob, false);
        const companies = await (await fetch(`${base}/seo/companies?offset=0&limit=5000`)).json();
        const sitemapCompany = companies.find((item: { slug: string }) => item.slug === seoCompany.slug);
        assert.ok(sitemapCompany);
        assert.equal(sitemapCompany.contentUpdatedAt, saved[0].contentUpdatedAt?.toISOString());
        const detail = await (await fetch(`${base}/companies/${seoCompany.slug}`)).json();
        assert.equal(detail.activeJobs, 5);
        const similar = await (await fetch(`${base}/jobs/${saved[0].slug}/similar`)).json();
        assert.ok(similar.length >= 4 && similar.length <= 6);
        assert.ok(similar.some((item: { company: { slug: string } }) => item.company.slug === seoCompany.slug));
        assert.ok(similar.every((item: { status: string }) => item.status === "ACTIVE"));
      } finally {
        await db.job.deleteMany({ where: { sourceId: seoSource.id } });
        await db.source.delete({ where: { id: seoSource.id } });
        await db.company.delete({ where: { id: seoCompany.id } });
      }
    });
  } finally {
    await app.close();
    await db.job.deleteMany({ where: { sourceId: source.id } });
    await db.source.delete({ where: { id: source.id } });
    await db.company.delete({ where: { id: company.id } });
    await db.$disconnect();
  }
});
