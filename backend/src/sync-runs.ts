import type { Queue } from "bullmq";
import type { PrismaClient, SyncRunTrigger } from "./generated/prisma/client.js";

export const ACTIVE_SYNC_RUN_STATUSES = ["QUEUED", "RUNNING"] as const;
export const SYNC_RUN_STALE_MS = 24 * 60 * 60_000;
type SyncQueue = Pick<Queue, "add">;

export class SyncRunAlreadyActiveError extends Error {
  constructor(readonly runId: string) {
    super("A global synchronization is already in progress");
  }
}

const message = (error: unknown) =>
  (error instanceof Error ? error.message : "Synchronization failed").slice(0, 1000);

export async function acquireSyncRun(db: PrismaClient, trigger: SyncRunTrigger) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vmiyou-global-sync-run')) IS NULL AS locked`;
    const active = await tx.syncRun.findFirst({
      where: { status: { in: [...ACTIVE_SYNC_RUN_STATUSES] } },
      orderBy: { createdAt: "asc" },
    });
    if (active) throw new SyncRunAlreadyActiveError(active.id);
    const sources = await tx.source.findMany({
      where: { enabled: true, company: { enabled: true }, type: { not: "MANUAL" } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return tx.syncRun.create({
      data: {
        trigger,
        totalSources: sources.length,
        sources: { create: sources.map(({ id }) => ({ sourceId: id })) },
      },
      include: { sources: true },
    });
  });
}

export async function enqueueSyncRun(queue: SyncQueue, runId: string) {
  return queue.add("all", { runId }, {
    jobId: `sync-run-${runId}`,
    deduplication: { id: "global-vacancy-sync" },
  });
}

export async function createManualSyncRun(db: PrismaClient, queue: SyncQueue) {
  const run = await acquireSyncRun(db, "MANUAL");
  try {
    await db.adminAuditLog.create({
      data: {
        action: "VACANCY_SYNC_RUN_REQUESTED",
        entityType: "sync-run",
        entityId: run.id,
        details: { trigger: "MANUAL", totalSources: run.totalSources },
      },
    });
    await enqueueSyncRun(queue, run.id);
    return run;
  } catch (error) {
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedSources: run.totalSources,
        failedSources: run.totalSources,
        finishedAt: new Date(),
      },
    });
    await db.syncRunSource.updateMany({
      where: { runId: run.id },
      data: { status: "FAILED", error: message(error), finishedAt: new Date() },
    });
    throw error;
  }
}

export async function markRunStarted(db: PrismaClient, runId: string) {
  return db.syncRun.updateMany({
    where: { id: runId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function markRunSourceStarted(db: PrismaClient, id: string) {
  await db.syncRunSource.updateMany({
    where: { id, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
}

export async function finishRunSource(
  db: PrismaClient,
  id: string,
  result: { skipped?: boolean; found?: number; created?: number; updated?: number; closed?: number },
) {
  const row = await db.syncRunSource.update({
    where: { id },
    data: {
      status: result.skipped ? "SKIPPED" : "SUCCESS",
      jobsFound: result.found ?? 0,
      jobsCreated: result.created ?? 0,
      jobsUpdated: result.updated ?? 0,
      jobsClosed: result.closed ?? 0,
      finishedAt: new Date(),
      error: result.skipped ? "Source job was skipped by its advisory lock" : null,
    },
  });
  return finalizeSyncRun(db, row.runId);
}

export async function failRunSource(db: PrismaClient, id: string, error: unknown) {
  const row = await db.syncRunSource.update({
    where: { id },
    data: { status: "FAILED", error: message(error), finishedAt: new Date() },
  });
  return finalizeSyncRun(db, row.runId);
}

export async function skipDeduplicatedRunSource(db: PrismaClient, id: string) {
  const row = await db.syncRunSource.update({
    where: { id },
    data: {
      status: "SKIPPED",
      error: "A source job was already queued or running; no result was attributed to this run",
      finishedAt: new Date(),
    },
  });
  return finalizeSyncRun(db, row.runId);
}

export async function finalizeSyncRun(db: PrismaClient, runId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "SyncRun" WHERE "id" = ${runId} FOR UPDATE`;
    const rows = await tx.syncRunSource.findMany({ where: { runId } });
    const terminal = rows.filter((row) => !["QUEUED", "RUNNING"].includes(row.status));
    const failed = rows.filter((row) => ["FAILED", "INTERRUPTED"].includes(row.status)).length;
    const succeeded = rows.filter((row) => row.status === "SUCCESS").length;
    const skipped = rows.filter((row) => row.status === "SKIPPED").length;
    const totals = rows.reduce((sum, row) => ({
      created: sum.created + row.jobsCreated,
      updated: sum.updated + row.jobsUpdated,
      closed: sum.closed + row.jobsClosed,
    }), { created: 0, updated: 0, closed: 0 });
    const complete = terminal.length === rows.length;
    const status = !complete ? "RUNNING"
      : rows.length === 0 ? "SKIPPED"
      : failed && succeeded ? "PARTIAL"
        : failed ? "FAILED"
          : skipped && succeeded ? "PARTIAL"
            : skipped ? "SKIPPED" : "SUCCESS";
    return tx.syncRun.update({
      where: { id: runId },
      data: {
        status,
        completedSources: terminal.length,
        failedSources: failed,
        jobsCreated: totals.created,
        jobsUpdated: totals.updated,
        jobsClosed: totals.closed,
        finishedAt: complete ? new Date() : null,
      },
    });
  });
}

export async function interruptStaleSyncRuns(db: PrismaClient, now = new Date()) {
  const staleBefore = new Date(now.getTime() - SYNC_RUN_STALE_MS);
  const runs = await db.syncRun.findMany({
    where: {
      status: { in: [...ACTIVE_SYNC_RUN_STATUSES] },
      createdAt: { lt: staleBefore },
    },
    select: { id: true },
  });
  for (const run of runs) {
    await db.syncRunSource.updateMany({
      where: { runId: run.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "INTERRUPTED", error: "Worker did not finish this source within 24 hours", finishedAt: now },
    });
    await finalizeSyncRun(db, run.id);
  }
  return runs.length;
}

export async function syncRunHistory(db: PrismaClient, page: number) {
  const take = 20;
  const [total, items] = await Promise.all([
    db.syncRun.count(),
    db.syncRun.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  return { items, total, page, pages: Math.ceil(total / take) };
}

export async function syncRunDetails(db: PrismaClient, id: string) {
  return db.syncRun.findUnique({
    where: { id },
    include: {
      sources: {
        orderBy: { createdAt: "asc" },
        include: { source: { select: { name: true, type: true, company: { select: { name: true } } } }, importLogs: { orderBy: { startedAt: "desc" }, take: 1 } },
      },
    },
  });
}
