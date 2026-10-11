import type { PrismaClient, AnalyticsSession } from "./generated/prisma/client.js";

export type VisitorType = "HUMAN" | "UNCERTAIN" | "LIKELY_BOT";

export function classifySession(session: Pick<AnalyticsSession,
  "knownBot" | "pages" | "jobViews" | "searches" | "filters" | "applyClicks" |
  "heartbeatCount" | "distinctPaths" | "startedAt" | "lastActivityAt"
>): { botScore: number; visitorType: VisitorType } {
  const seconds = Math.max(1, (session.lastActivityAt.getTime() - session.startedAt.getTime()) / 1000);
  let score = session.knownBot ? 100 : 50;
  if (!session.knownBot) {
    if (session.pages >= 15 && session.pages / (seconds / 60) > 20) score += 35;
    if (session.distinctPaths >= 15 && seconds < 60) score += 25;
    if (session.pages >= 3 && seconds < 3) score += 15;
    if (session.heartbeatCount > 0) score -= 22;
    if (session.searches > 0) score -= 20;
    if (session.filters > 0) score -= 15;
    if (session.jobViews > 0) score -= 20;
    if (session.applyClicks > 0) score -= 30;
    if (session.heartbeatCount >= 2 && seconds >= 60) score -= 10;
  }
  const botScore = Math.max(0, Math.min(100, score));
  return { botScore, visitorType: botScore >= 70 ? "LIKELY_BOT" : botScore <= 35 ? "HUMAN" : "UNCERTAIN" };
}

export async function refreshClassification(db: PrismaClient, session: AnalyticsSession) {
  const classification = classifySession(session);
  if (classification.botScore !== session.botScore || classification.visitorType !== session.visitorType)
    await db.analyticsSession.update({ where: { id: session.id }, data: classification });
}

export async function recordSessionEvent(
  db: PrismaClient,
  data: { sessionId: string; visitorId: string; type: string; path: string; country?: string; city?: string; referrer?: string; device: string; userAgent?: string },
) {
  const existing = await db.analyticsSession.findUnique({ where: { id: data.sessionId }, select: { id: true } });
  const now = new Date();
  const session = await db.analyticsSession.upsert({
    where: { id: data.sessionId },
    create: {
      id: data.sessionId,
      visitorId: data.visitorId,
      startedAt: now,
      lastActivityAt: now,
      pages: data.type === "PAGE_VIEW" ? 1 : 0,
      jobViews: data.type === "JOB_VIEW" ? 1 : 0,
      applyClicks: data.type === "APPLY_CLICK" ? 1 : 0,
      distinctPaths: 1,
      knownBot: /bot|crawler|spider|headless|lighthouse|preview/i.test(data.userAgent || ""),
      country: data.country,
      city: data.city,
      referrer: data.referrer,
      device: data.device,
    },
    update: {
      lastActivityAt: now,
      pages: { increment: data.type === "PAGE_VIEW" ? 1 : 0 },
      jobViews: { increment: data.type === "JOB_VIEW" ? 1 : 0 },
      applyClicks: { increment: data.type === "APPLY_CLICK" ? 1 : 0 },
      country: data.country,
      city: data.city,
      device: data.device,
    },
  });
  if (existing) {
    const seen = await db.analyticsEvent.count({ where: { sessionId: data.sessionId, path: data.path } });
    if (seen === 1) {
      session.distinctPaths++;
      await db.analyticsSession.update({ where: { id: data.sessionId }, data: { distinctPaths: { increment: 1 } } });
    }
  }
  await refreshClassification(db, session);
}

export async function recordActivity(db: PrismaClient, data: { sessionId: string; visitorId: string; kind: "HEARTBEAT" | "SEARCH" | "FILTER"; seconds?: number }) {
  const now = new Date();
  const current = await db.analyticsSession.findUnique({ where: { id: data.sessionId } });
  if (!current || current.visitorId !== data.visitorId) return;
  const elapsed = Math.max(0, Math.min(60, data.seconds ?? 0, Math.floor((now.getTime() - current.lastActivityAt.getTime()) / 1000)));
  const session = await db.analyticsSession.update({
    where: { id: data.sessionId },
    data: {
      lastActivityAt: now,
      ...(data.kind === "HEARTBEAT" ? {
        activeSeconds: { increment: elapsed },
        pageSeconds: { increment: elapsed },
        heartbeatCount: { increment: 1 },
      } : data.kind === "SEARCH" ? { searches: { increment: 1 } } : { filters: { increment: 1 } }),
    },
  });
  await refreshClassification(db, session);
}
