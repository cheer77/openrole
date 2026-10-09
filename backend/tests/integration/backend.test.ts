import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { normalize } from "../../src/providers/normalize.js";
import { syncSource } from "../../src/sync.js";
import { cleanupClosedJobs } from "../../src/cleanup.js";

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
        assert.equal(after.firstSeenAt.toISOString(), start.toISOString());
        assert.equal(after.publishedAt, null);
        assert.equal(after.sortDate.toISOString(), start.toISOString());
        assert.equal(after.lastSeenAt?.toISOString(), new Date(start.getTime() + 3600000).toISOString());
        assert.equal(after.missingCount, 0);
        assert.equal(await db.job.count({ where: { sourceId: source.id } }), 1);
      },
    );

    await t.test(
      "API searches, filters, pagination and validation",
      async () => {
        const response = await fetch(
          `${base}/jobs?search=Frontend&country=ES&remoteType=REMOTE&technologies=React,TypeScript&salaryMin=70000&currency=EUR&limit=1`,
        );
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.total, 1);
        assert.equal(body.items.length, 1);
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
        assert.ok(jobs.some((item: { slug: string }) => item.slug === saved[0].slug));
        const companies = await (await fetch(`${base}/seo/companies?offset=0&limit=5000`)).json();
        assert.ok(companies.some((item: { slug: string }) => item.slug === seoCompany.slug));
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
