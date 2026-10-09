import { trafficChart } from "./chart-analytics.js";
import { z } from "zod";
import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
export const eventSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["PAGE_VIEW", "JOB_VIEW", "APPLY_CLICK"]),
    visitorId: z.string().uuid(),
    sessionId: z.string().uuid(),
    path: z
      .string()
      .max(250)
      .regex(/^\/(?:jobs(?:\/[a-zA-Z0-9_-]+)?|companies(?:\/[a-zA-Z0-9_-]+)?|(?:categories|technologies|locations)\/[a-zA-Z0-9_-]+|remote-jobs|privacy)?$/),
    jobId: z.string().max(100).optional(),
    referrer: z.string().max(253).optional(),
    utmSource: z.string().max(100).optional(),
    utmMedium: z.string().max(100).optional(),
    utmCampaign: z.string().max(100).optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    region: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    userAgent: z.string().max(500).optional(),
  })
  .strict();
export function trafficSource(utm = "", referrer = "") {
  const source = utm.toLowerCase();
  const host = referrer.toLowerCase();
  const matches = (domain: string) =>
    host === domain || host.endsWith("." + domain);
  if (
    source === "google" ||
    /^(?:www\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host)
  )
    return "Google";
  if (
    ["telegram", "tg"].includes(source) ||
    matches("t.me") ||
    matches("telegram.org")
  )
    return "Telegram";
  if (source === "linkedin" || matches("linkedin.com")) return "LinkedIn";
  if (
    ["facebook", "fb"].includes(source) ||
    matches("facebook.com") ||
    matches("fb.com")
  )
    return "Facebook";
  if (source === "reddit" || matches("reddit.com")) return "Reddit";
  return source || host ? "Other" : "Direct";
}
export function deviceInfo(ua = "") {
  const device = /ipad|tablet/i.test(ua)
    ? "Tablet"
    : /mobile|iphone|android/i.test(ua)
      ? "Mobile"
      : "Desktop";
  const browser = /edg/i.test(ua)
    ? "Edge"
    : /firefox|fxios/i.test(ua)
      ? "Firefox"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "Other";
  const os = /iphone|ipad/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /macintosh|mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Other";
  return { device, browser, os };
}
export function dateRange(range: string, now = new Date()) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const days = range === "today" || range === "yesterday" ? 1 : Number(range);
  if (![1, 7, 30, 90].includes(days)) throw new Error("Invalid range");
  const end = range === "yesterday" ? today : now;
  const start = new Date(
    today.getTime() - (range === "yesterday" ? 1 : days - 1) * 86400000,
  );
  return { start, end, bucket: days === 1 ? "hour" : "day" };
}
type Metrics = {
  visitors: number;
  sessions: number;
  pageViews: number;
  jobViews: number;
  applyClicks: number;
  ctr: number;
};
const metrics = Prisma.sql`COUNT(DISTINCT "visitorId")::int AS visitors, COUNT(DISTINCT "sessionId")::int AS sessions, COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int AS "pageViews", COUNT(*) FILTER (WHERE type = 'JOB_VIEW')::int AS "jobViews", COUNT(*) FILTER (WHERE type = 'APPLY_CLICK')::int AS "applyClicks"`;
const withCtr = <T extends { jobViews: number; applyClicks: number }>(
  row: T,
) => ({
  ...row,
  ctr: row.jobViews
    ? Math.round((row.applyClicks / row.jobViews) * 1000) / 10
    : 0,
});
export async function analyticsReport(
  db: PrismaClient,
  range: string,
  now = new Date(),
) {
  const { start, end, bucket } = dateRange(range, now);
  const window = Prisma.sql`"occurredAt" >= ${start} AND "occurredAt" < ${end}`;
  const [
    summary,
    series,
    countries,
    cities,
    traffic,
    devices,
    browsers,
    operatingSystems,
    campaigns,
    referrers,
    jobs,
    inventory,
    recentVisitors,
    chart,
  ] = await Promise.all([
    db.$queryRaw<Metrics[]>(
      Prisma.sql`SELECT ${metrics} FROM "AnalyticsEvent" WHERE ${window}`,
    ),
    db.$queryRaw<(Metrics & { date: Date })[]>(
      Prisma.sql`SELECT date_trunc(${bucket}, "occurredAt") AS date, ${metrics} FROM "AnalyticsEvent" WHERE ${window} GROUP BY 1 ORDER BY 1`,
    ),
    db.$queryRaw<(Metrics & { country: string | null })[]>(
      Prisma.sql`SELECT country, ${metrics} FROM "AnalyticsEvent" WHERE ${window} GROUP BY country ORDER BY visitors DESC LIMIT 250`,
    ),
    db.$queryRaw<
      (Metrics & {
        city: string;
        country: string | null;
        region: string | null;
      })[]
    >(
      Prisma.sql`SELECT city, country, region, ${metrics} FROM "AnalyticsEvent" WHERE ${window} AND city IS NOT NULL GROUP BY city,country,region ORDER BY visitors DESC LIMIT 20`,
    ),
    db.$queryRaw<(Metrics & { source: string })[]>(
      Prisma.sql`SELECT "trafficSource" AS source, ${metrics} FROM "AnalyticsEvent" WHERE ${window} GROUP BY "trafficSource" ORDER BY visitors DESC`,
    ),
    db.$queryRaw<{ name: string; visitors: number }[]>(
      Prisma.sql`SELECT device AS name, COUNT(DISTINCT "visitorId")::int AS visitors FROM "AnalyticsEvent" WHERE ${window} GROUP BY device ORDER BY visitors DESC`,
    ),
    db.$queryRaw<{ name: string; visitors: number }[]>(
      Prisma.sql`SELECT browser AS name, COUNT(DISTINCT "visitorId")::int AS visitors FROM "AnalyticsEvent" WHERE ${window} GROUP BY browser ORDER BY visitors DESC`,
    ),
    db.$queryRaw<{ name: string; visitors: number }[]>(
      Prisma.sql`SELECT os AS name, COUNT(DISTINCT "visitorId")::int AS visitors FROM "AnalyticsEvent" WHERE ${window} GROUP BY os ORDER BY visitors DESC`,
    ),
    db.$queryRaw<
      {
        source: string | null;
        medium: string | null;
        campaign: string | null;
        visitors: number;
      }[]
    >(
      Prisma.sql`SELECT "utmSource" AS source, "utmMedium" AS medium, "utmCampaign" AS campaign, COUNT(DISTINCT "visitorId")::int AS visitors FROM "AnalyticsEvent" WHERE ${window} AND "utmSource" IS NOT NULL GROUP BY 1,2,3 ORDER BY visitors DESC LIMIT 20`,
    ),
    db.$queryRaw<{ name: string; visitors: number }[]>(
      Prisma.sql`SELECT referrer AS name, COUNT(DISTINCT "visitorId")::int AS visitors FROM "AnalyticsEvent" WHERE ${window} AND referrer IS NOT NULL GROUP BY referrer ORDER BY visitors DESC LIMIT 20`,
    ),
    db.$queryRaw<
      {
        id: string;
        title: string;
        company: string;
        jobViews: number;
        applyClicks: number;
      }[]
    >(
      Prisma.sql`SELECT e."jobId" AS id, COALESCE(j.title, x.title, 'Deleted job') AS title, COALESCE(c.name, x."companyName", '—') AS company, COUNT(*) FILTER(WHERE e.type='JOB_VIEW')::int AS "jobViews", COUNT(*) FILTER(WHERE e.type='APPLY_CLICK')::int AS "applyClicks" FROM "AnalyticsEvent" e LEFT JOIN "Job" j ON j.id=e."jobId" LEFT JOIN "ExpiredJob" x ON x.id=e."jobId" LEFT JOIN "Company" c ON c.id=j."companyId" WHERE e."occurredAt" >= ${start} AND e."occurredAt" < ${end} AND e."jobId" IS NOT NULL GROUP BY e."jobId",j.title,x.title,c.name,x."companyName"`,
    ),
    Promise.all([
      db.job.count(),
      db.job.count({ where: { status: "ACTIVE" } }),
      db.job.count({ where: { status: "CLOSED" } }),
      db.job.count({ where: { status: "HIDDEN" } }),
      db.job.count({
        where: { firstSeenAt: { gte: dateRange("today").start } },
      }),
      db.company.count(),
      db.source.count(),
    ]),
    Promise.all(
      ["today", "7", "30"].map(async (r) => {
        const result = await db.$queryRaw<{ count: number }[]>(
          Prisma.sql`SELECT COUNT(DISTINCT "visitorId")::int AS count FROM "AnalyticsEvent" WHERE "occurredAt" >= ${dateRange(r).start}`,
        );
        return result[0].count;
      }),
    ),
    trafficChart(db, range, start, end, bucket, now),
  ]);
  const slots: (Metrics & { date: string })[] = [];
  for (
    let timestamp = start.getTime();
    timestamp <= end.getTime() &&
    (range !== "yesterday" || timestamp < end.getTime());
    timestamp += bucket === "hour" ? 3600000 : 86400000
  ) {
    const found = series.find(
      (item) => new Date(item.date).getTime() === timestamp,
    );
    slots.push({
      visitors: 0,
      sessions: 0,
      pageViews: 0,
      jobViews: 0,
      applyClicks: 0,
      ctr: 0,
      ...found,
      date: new Date(timestamp).toISOString(),
    });
  }
  const ranked = jobs.map(withCtr);
  return {
    chart,
    range,
    start,
    end,
    summary: withCtr(summary[0]),
    series: slots.map(withCtr),
    countries: countries.map(withCtr),
    cities,
    traffic,
    devices,
    browsers,
    operatingSystems,
    campaigns,
    referrers,
    topViewed: [...ranked].sort((a, b) => b.jobViews - a.jobViews).slice(0, 10),
    topApplied: [...ranked]
      .sort((a, b) => b.applyClicks - a.applyClicks)
      .slice(0, 10),
    topCtr: ranked
      .filter((j) => j.jobViews >= 5)
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, 10),
    inventory: {
      totalJobs: inventory[0],
      activeJobs: inventory[1],
      closedJobs: inventory[2],
      hiddenJobs: inventory[3],
      jobsAddedToday: inventory[4],
      companies: inventory[5],
      sources: inventory[6],
    },
    visitorsToday: recentVisitors[0],
    visitorsWeek: recentVisitors[1],
    visitorsMonth: recentVisitors[2],
  };
}
export async function retainData(db: PrismaClient, now = new Date()) {
  await db.analyticsEvent.deleteMany({
    where: { occurredAt: { lt: new Date(now.getTime() - 90 * 86400000) } },
  });
  await db.importLog.deleteMany({
    where: { startedAt: { lt: new Date(now.getTime() - 30 * 86400000) } },
  });
  await db.importLog.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: new Date(now.getTime() - 3600000) },
    },
    data: {
      status: "INTERRUPTED",
      finishedAt: now,
      error: "Worker stopped before completing the import",
    },
  });
  await db.adminSession.deleteMany({ where: { expiresAt: { lt: now } } });
}
