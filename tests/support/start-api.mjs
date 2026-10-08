// Real Nest/PostgreSQL fixture server. Never seeds the development database.
import { getMockJobs } from "../fixtures/jobs.ts";
import { scryptSync } from "node:crypto";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile("backend/.env");
} catch {
  /* CI supplies environment variables. */
}
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must name a dedicated *_test database");
process.env.DATABASE_URL = url;
process.env.INTERNAL_API_KEY =
  "test-internal-key-openrole-012345678901234567890";
const salt = "01234567890123456789012345678901";
process.env.OWNER_PASSWORD_HASH =
  salt +
  ":" +
  scryptSync("test-owner-password-only-2026", salt, 64).toString("hex");
process.env.REDIS_URL = "redis://127.0.0.1:6380/15";
const { createDb } = await import("../../backend/dist/src/db.js");
const { createApp } = await import("../../backend/dist/src/app.js");
const db = createDb(url);
// Tests share a dedicated database. Do not run concurrently with backend integration tests.
await db.analyticsEvent.deleteMany();
await db.adminSession.deleteMany();
// Chart tests reuse a fixture session; authentication is tested separately.
const { sessionHash } = await import("../../backend/dist/src/admin-auth.js");
await db.adminSession.create({
  data: {
    tokenHash: sessionHash("a".repeat(64)),
    expiresAt: new Date(Date.now() + 3600000),
  },
});
await db.job.deleteMany();
await db.source.deleteMany();
await db.company.deleteMany();
const jobs = getMockJobs();
for (const job of jobs) {
  const slug = job.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const company = await db.company.upsert({
    where: { slug },
    update: {},
    create: { slug, name: job.company.name, careerUrl: job.company.website },
  });
  const source = await db.source.upsert({
    where: {
      type_sourceIdentifier: { type: "MANUAL", sourceIdentifier: slug },
    },
    update: {},
    create: {
      name: job.company.name,
      type: "MANUAL",
      sourceIdentifier: slug,
      companyId: company.id,
      enabled: true,
    },
  });
  await db.job.create({
    data: {
      id: job.id,
      externalId: job.id,
      slug: job.slug,
      title: job.title,
      companyId: company.id,
      sourceId: source.id,
      category: job.category,
      location: job.location,
      remoteType: { Remote: "REMOTE", Hybrid: "HYBRID", "On-site": "ON_SITE" }[
        job.workType
      ],
      experienceLevel: job.experience,
      technologies: job.technologies,
      salaryMin: job.salary?.min,
      salaryMax: job.salary?.max,
      currency: job.salary?.currency,
      description: [
        ...job.description,
        "What you’ll bring",
        ...job.requirements,
        ...job.technologies,
      ].join("\n\n"),
      shortDescription: job.shortDescription,
      sourceUrl: job.applyUrl,
      applyUrl: job.applyUrl,
      publishedAt: new Date(job.publishedAt),
      firstSeenAt: new Date(job.firstSeenAt),
      lastCheckedAt: new Date(),
      sortDate: new Date(job.publishedAt),
    },
  });
}
await db.$disconnect();
const app = await createApp();
// Failure/latency injection is confined to this test server, never production code.
const failures = new Set();
app.use((req, res, next) => {
  const url = new URL(req.url, "http://localhost");
  const query = url.searchParams.get("search") || "";
  if (query.startsWith("__test_outage_") && !failures.has(query)) {
    failures.add(query);
    return res.status(503).json({ message: "Test service interruption" });
  }
  if (query.startsWith("__test_outage_") || query.startsWith("__test_slow_")) {
    url.searchParams.set("search", "Frontend");
    req.url = `${url.pathname}?${url.searchParams}`;
  }
  if (query.startsWith("__test_slow_")) return setTimeout(next, 1000);
  next();
});
await app.listen(4001, "127.0.0.1");
