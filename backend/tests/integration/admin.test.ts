import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Dedicated *_test database required");
process.env.DATABASE_URL = url;
const password = randomBytes(20).toString("hex"),
  salt = randomBytes(16).toString("hex");
process.env.OWNER_PASSWORD_HASH =
  salt + ":" + scryptSync(password, salt, 64).toString("hex");
process.env.INTERNAL_API_KEY = randomBytes(32).toString("hex");
const { createDb } = await import("../../src/db.js");
const { createApp } = await import("../../src/app.js");
const { syncSource } = await import("../../src/sync.js");
const { normalize } = await import("../../src/providers/normalize.js");
const { retainData } = await import("../../src/analytics.js");
const { sessionHash } = await import("../../src/admin-auth.js");

test("owner authentication, management, import overrides and private analytics", async (t) => {
  const db = createDb(url),
    uid = randomUUID();
  const company = await db.company.create({
    data: { name: "Owner test " + uid, slug: uid },
  });
  const source = await db.source.create({
    data: {
      name: "Owner test board",
      companyId: company.id,
      type: "ASHBY",
      sourceIdentifier: uid,
      enabled: true,
    },
  });
  const original = normalize({
    externalId: "one",
    title: "Frontend Developer",
    description: "React developer",
    location: "Madrid",
    country: "Spain",
    workplace: "Remote",
    sourceUrl: "https://example.com/job",
    applyUrl: "https://example.com/apply",
  });
  const provider = { fetch: async () => [original] };
  await syncSource(db, source.id, provider);
  let job = await db.job.findFirstOrThrow({ where: { sourceId: source.id } });
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  let token = "";
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    auth = true,
  ) =>
    fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: "Bearer " + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async (pass = password) =>
    fetch(base + "/owner-auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": process.env.INTERNAL_API_KEY!,
      },
      body: JSON.stringify({ password: pass }),
    });
  try {
    await t.test(
      "all private endpoints require a valid owner session",
      async () => {
        for (const path of [
          "/admin/dashboard",
          "/admin/jobs",
          "/admin/companies",
          "/admin/sources",
          "/admin/logs",
        ])
          assert.equal((await call(path, "GET", undefined, false)).status, 401);
        assert.equal(
          (await call(`/admin/jobs/${job.id}`, "DELETE", undefined, false))
            .status,
          401,
        );
        assert.equal((await login("wrong")).status, 401);
        const result = await login();
        assert.equal(result.status, 201);
        token = (await result.json()).token;
        assert.match(token, /^[a-f0-9]{64}$/);
        assert.ok(
          await db.adminSession.findUnique({
            where: { tokenHash: sessionHash(token) },
          }),
        );
        assert.equal((await call("/admin/session")).status, 200);
      },
    );
    await t.test(
      "manual edits, hidden/closed states survive sync and reset restores source values",
      async () => {
        const edit = {
          title: "Owner edited title",
          description: "Manually reviewed",
          shortDescription: "Reviewed",
          category: "Frontend",
          location: "Spain",
          remoteType: "REMOTE",
          experienceLevel: null,
          salaryMin: null,
          salaryMax: null,
          currency: null,
          technologies: ["React"],
          applyUrl: "https://example.com/apply",
        };
        assert.equal(
          (await call(`/admin/jobs/${job.id}`, "PATCH", edit)).status,
          200,
        );
        assert.equal(
          (
            await call(`/admin/jobs/${job.id}/status`, "PATCH", {
              status: "HIDDEN",
            })
          ).status,
          200,
        );
        await syncSource(db, source.id, provider);
        job = await db.job.findUniqueOrThrow({ where: { id: job.id } });
        assert.equal(job.title, "Owner edited title");
        assert.equal(job.status, "HIDDEN");
        assert.equal(
          (await call("/jobs/" + job.slug, "GET", undefined, false)).status,
          404,
        );
        await call(`/admin/jobs/${job.id}/status`, "PATCH", {
          status: "CLOSED",
        });
        await syncSource(db, source.id, provider);
        assert.equal(
          (await db.job.findUniqueOrThrow({ where: { id: job.id } })).status,
          "CLOSED",
        );
        await call(`/admin/jobs/${job.id}/reset`, "POST", {});
        await syncSource(db, source.id, provider);
        job = await db.job.findUniqueOrThrow({ where: { id: job.id } });
        assert.equal(job.title, original.title);
        assert.equal(job.status, "ACTIVE");
      },
    );
    await t.test(
      "an in-progress import cannot overwrite a concurrent owner edit",
      async () => {
        let release!: () => void;
        let started!: () => void;
        const ready = new Promise<void>((r) => (started = r));
        const wait = new Promise<void>((r) => (release = r));
        const sync = syncSource(db, source.id, {
          fetch: async () => {
            started();
            await wait;
            return [original];
          },
        });
        await ready;
        try {
          assert.equal(
            (
              await call(`/admin/jobs/${job.id}/status`, "PATCH", {
                status: "HIDDEN",
              })
            ).status,
            409,
          );
        } finally {
          release();
          await sync;
        }
      },
    );
    await t.test(
      "disabling companies removes their jobs and pauses imports",
      async () => {
        const body = {
          name: company.name,
          slug: company.slug,
          website: null,
          careerUrl: null,
          country: null,
          enabled: false,
        };
        assert.equal(
          (await call(`/admin/companies/${company.id}`, "PATCH", body)).status,
          200,
        );
        assert.equal(
          (await call("/jobs/" + job.slug, "GET", undefined, false)).status,
          404,
        );
        assert.deepEqual(await syncSource(db, source.id, provider), {
          skipped: true,
        });
        await call(`/admin/companies/${company.id}`, "PATCH", {
          ...body,
          enabled: true,
        });
        assert.equal(
          (
            await call(`/admin/sources/${source.id}`, "PATCH", {
              name: source.name,
              type: "ASHBY",
              companyId: company.id,
              sourceIdentifier: "different-board",
              enabled: true,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "analytics is idempotent, validates job provenance, aggregates and never records raw IP",
      async () => {
        await db.analyticsEvent.deleteMany();
        const visitorId = randomUUID(),
          sessionId = randomUUID();
        const event = {
          id: randomUUID(),
          visitorId,
          sessionId,
          type: "PAGE_VIEW",
          path: "/",
          country: "ES",
          city: "Madrid",
          region: "Madrid",
          referrer: "www.google.com",
          utmSource: "google",
          utmMedium: "organic",
          utmCampaign: "launch",
          userAgent: "Mozilla Chrome Safari",
        };
        const record = (data: unknown, key = process.env.INTERNAL_API_KEY!) =>
          fetch(base + "/events", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-internal-key": key,
            },
            body: JSON.stringify(data),
          });
        assert.equal((await record(event, "bad")).status, 401);
        assert.equal((await record(event)).status, 204);
        await record(event);
        assert.equal(
          (
            await record({
              ...event,
              id: randomUUID(),
              type: "JOB_VIEW",
              jobId: job.id,
              path: "/jobs/" + job.slug,
            })
          ).status,
          204,
        );
        await record({
          ...event,
          id: randomUUID(),
          type: "APPLY_CLICK",
          jobId: job.id,
          path: "/jobs/" + job.slug,
        });
        assert.equal(
          (
            await record({
              ...event,
              id: randomUUID(),
              type: "JOB_VIEW",
              jobId: job.id,
              path: "/jobs/not-the-job",
            })
          ).status,
          400,
        );
        assert.equal(
          (await record({ ...event, id: randomUUID(), ip: "1.2.3.4" })).status,
          400,
        );
        const report = await (
          await call("/admin/dashboard?range=today")
        ).json();
        assert.equal(report.summary.visitors, 1);
        assert.equal(report.summary.sessions, 1);
        assert.equal(report.summary.pageViews, 1);
        assert.equal(report.summary.jobViews, 1);
        assert.equal(report.summary.applyClicks, 1);
        assert.equal(report.summary.ctr, 100);
        assert.equal(report.countries[0].country, "ES");
        assert.equal(report.cities[0].city, "Madrid");
        assert.equal(report.traffic[0].source, "Google");
        assert.equal(report.topViewed[0].id, job.id);
        assert.equal(
          report.topCtr.length,
          0,
          "CTR ranking requires at least five views",
        );
        await record({
          ...event,
          id: randomUUID(),
          visitorId: randomUUID(),
          sessionId: randomUUID(),
          country: undefined,
          city: undefined,
          region: undefined,
          referrer: undefined,
          utmSource: undefined,
        });
        const unknown = await (await call("/admin/dashboard?range=7")).json();
        assert.ok(
          unknown.countries.some(
            (c: { country: string | null }) => c.country === null,
          ),
        );
        assert.equal(await db.analyticsEvent.count(), 4);
      },
    );
    await t.test(
      "deletion is permanent across imports; import failures retain logs",
      async () => {
        assert.equal(
          (await call(`/admin/jobs/${job.id}`, "DELETE")).status,
          200,
        );
        await syncSource(db, source.id, provider);
        assert.equal(await db.job.count({ where: { sourceId: source.id } }), 0);
        await assert.rejects(
          syncSource(db, source.id, {
            fetch: async () => {
              throw new Error("Provider unavailable");
            },
          }),
        );
        const log = await db.importLog.findFirstOrThrow({
          where: { sourceId: source.id, status: "FAILED" },
        });
        assert.equal(log.error, "Provider unavailable");
        assert.ok(log.finishedAt);
      },
    );
    await t.test(
      "retention deletes old events and logs and expired sessions",
      async () => {
        const old = new Date(Date.now() - 91 * 86400000);
        const event = await db.analyticsEvent.findFirstOrThrow();
        await db.analyticsEvent.create({
          data: { ...event, id: randomUUID(), occurredAt: old },
        });
        await db.importLog.create({
          data: {
            sourceId: source.id,
            status: "SUCCESS",
            startedAt: old,
            finishedAt: old,
          },
        });
        await db.adminSession.create({
          data: { tokenHash: "expired-test-" + uid, expiresAt: old },
        });
        await retainData(db);
        assert.equal(
          await db.analyticsEvent.count({
            where: { occurredAt: { lt: new Date(Date.now() - 90 * 86400000) } },
          }),
          0,
        );
        assert.equal(
          await db.importLog.count({
            where: { sourceId: source.id, startedAt: old },
          }),
          0,
        );
        assert.equal(
          await db.adminSession.count({
            where: { tokenHash: "expired-test-" + uid },
          }),
          0,
        );
      },
    );
    await t.test(
      "logout revokes access and password rotation invalidates sessions",
      async () => {
        await call("/admin/logout", "POST", {});
        assert.equal((await call("/admin/session")).status, 401);
        token = (await (await login()).json()).token;
        process.env.OWNER_PASSWORD_HASH = "rotated";
        assert.equal((await call("/admin/session")).status, 401);
      },
    );
  } finally {
    await app.close();
    await db.analyticsEvent.deleteMany();
    await db.job.deleteMany({ where: { sourceId: source.id } });
    await db.source.delete({ where: { id: source.id } });
    await db.company.delete({ where: { id: company.id } });
    await db.$disconnect();
  }
});
