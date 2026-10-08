import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const DAY = 86400000;
export function comparisonWindow(
  start: Date,
  end: Date,
  range: string,
  now: Date,
) {
  const days = range === "today" || range === "yesterday" ? 1 : Number(range);
  return {
    start: new Date(start.getTime() - days * DAY),
    end: new Date(end.getTime() - days * DAY),
    // Do not compare retained data against a partially deleted historical window.
    available: start.getTime() - days * DAY >= now.getTime() - 90 * DAY,
  };
}
type Counts = {
  visitors: number;
  pageViews: number;
  jobViews: number;
  applyClicks: number;
  jobViewers: number;
  applyUsers: number;
};
const empty: Counts = {
  visitors: 0,
  pageViews: 0,
  jobViews: 0,
  applyClicks: 0,
  jobViewers: 0,
  applyUsers: 0,
};
const values = (row: Counts = empty) => ({
  visitors: row.visitors,
  pageViews: row.pageViews,
  jobViews: row.jobViews,
  applyClicks: row.applyClicks,
  jobViewers: row.jobViewers,
  applyUsers: row.applyUsers,
  applyConversion: row.jobViewers
    ? Math.round((row.applyUsers / row.jobViewers) * 1000) / 10
    : null,
});

export async function trafficChart(
  db: PrismaClient,
  range: string,
  start: Date,
  end: Date,
  bucket: string,
  now: Date,
) {
  const previous = comparisonWindow(start, end, range, now);
  // A single indexed event-window query supplies every series and both summaries.
  // Summaries deduplicate across the whole period, not the sum of daily uniques.
  const rows = await db.$queryRaw<
    (Counts & { period: string; timestamp: Date | null })[]
  >(Prisma.sql`
    WITH windowed AS (
      SELECT *, CASE WHEN "occurredAt" >= ${start} THEN 'current' ELSE 'previous' END AS period
      FROM "AnalyticsEvent"
      WHERE ("occurredAt" >= ${start} AND "occurredAt" < ${end})
        OR (${previous.available} AND "occurredAt" >= ${previous.start} AND "occurredAt" < ${previous.end})
    ), scopes AS (
      SELECT period, NULL::timestamp AS timestamp, "visitorId", type FROM windowed
      UNION ALL
      SELECT period, date_trunc(${bucket}, "occurredAt"), "visitorId", type FROM windowed WHERE period = 'current'
    ), people AS (
      SELECT period, timestamp, "visitorId",
        COUNT(*) FILTER (WHERE type = 'PAGE_VIEW')::int AS pages,
        COUNT(*) FILTER (WHERE type = 'JOB_VIEW')::int AS views,
        COUNT(*) FILTER (WHERE type = 'APPLY_CLICK')::int AS clicks
      FROM scopes GROUP BY period, timestamp, "visitorId"
    )
    SELECT period, timestamp, COUNT(*)::int AS visitors,
      SUM(pages)::int AS "pageViews", SUM(views)::int AS "jobViews", SUM(clicks)::int AS "applyClicks",
      COUNT(*) FILTER (WHERE views > 0)::int AS "jobViewers",
      COUNT(*) FILTER (WHERE views > 0 AND clicks > 0)::int AS "applyUsers"
    FROM people GROUP BY period, timestamp ORDER BY timestamp
  `);
  const current = values(
    rows.find((r) => r.period === "current" && r.timestamp === null),
  );
  const previousValues = values(
    rows.find((r) => r.period === "previous" && r.timestamp === null),
  );
  const byTime = new Map(
    rows.filter((r) => r.timestamp).map((r) => [r.timestamp!.getTime(), r]),
  );
  const step = bucket === "hour" ? 3600000 : DAY;
  const calendarEnd =
    range === "today" || range === "yesterday"
      ? start.getTime() + DAY
      : Math.floor(end.getTime() / DAY) * DAY + DAY;
  const series = [];
  for (let time = start.getTime(); time < calendarEnd; time += step) {
    series.push({
      timestamp: new Date(time).toISOString(),
      ...values(byTime.get(time)),
      future: time >= end.getTime(),
      partial: time < end.getTime() && time + step > end.getTime(),
    });
  }
  return {
    granularity: bucket,
    currentPeriod: { start, end, metrics: current },
    previousPeriod: {
      start: previous.start,
      end: previous.end,
      available: previous.available,
      metrics: previous.available ? previousValues : null,
    },
    series,
  };
}
