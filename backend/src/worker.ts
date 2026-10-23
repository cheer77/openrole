import { retainData } from "./analytics.js";
import { Worker } from "bullmq";
import { createDb } from "./db.js";
import { createQueue, enqueueSources, enqueueCompanyDiscovery, queueName } from "./queue.js";
import { redisConnection } from "./config.js";
import { syncSource } from "./sync.js";
import { cleanupClosedJobs } from "./cleanup.js";
import { getProvider } from "./providers/providers.js";
import { isTransientProviderError } from "./providers/http.js";
import { bootstrapDiscovery, discoverCompany } from "./discovery/index.js";
import { reclassifyJobs } from "./jobs/reclassify.js";
import {
  reconcileVacancySyncScheduler,
  VACANCY_SYNC_RECONCILE_INTERVAL_MS,
} from "./worker-schedule.js";

async function main() {
  const db = createDb();
  await db.$connect();
  // A hard restart cannot finish the ImportLog row owned by the previous
  // worker process. Reconcile stale rows immediately instead of waiting for
  // the next scheduled sync tick.
  await retainData(db);
  const queue = createQueue();
  // Control-plane commands must fail instead of lingering after the database
  // row lock expires; otherwise an old revision could apply after a newer one.
  const schedulerQueue = createQueue({ failFast: true });
  await queue.setGlobalConcurrency(2);
  const syncConfig = await reconcileVacancySyncScheduler(db, schedulerQueue);
  await queue.upsertJobScheduler(
    "daily-cleanup",
    { every: 86400000 },
    { name: "cleanup", data: {} },
  );
  await queue.upsertJobScheduler(
    "daily-discovery", { every: 86400000 }, { name: "discover-all", data: {} },
  );
  await queue.upsertJobScheduler(
    "daily-reclassify", { every: 86400000 }, { name: "reclassify-jobs", data: {} },
  );
  await queue.add("reclassify-jobs", {}, { deduplication: { id: "reclassify-jobs" } });
  await queue.add("discover-all", {}, { deduplication: { id: "discover-all" } });
  const worker = new Worker<{ sourceId?: string; companyId?: string; force?: boolean }>(
    queueName,
    async (job) => {
      if (job.name === "all") {
        await retainData(db);
        return { queued: await enqueueSources(queue, db) };
      }
      if (job.name === "cleanup") return cleanupClosedJobs(db);
      if (job.name === "reclassify-jobs") return reclassifyJobs(db);
      if (job.name === "discover-all") {
        const bootstrap = await bootstrapDiscovery(db);
        for (const sourceId of bootstrap.createdSourceIds)
          await enqueueSources(queue, db, sourceId);
        return { companiesAdded: bootstrap.added, sourcesAdded: bootstrap.createdSourceIds.length,
          queued: await enqueueCompanyDiscovery(queue, db) };
      }
      if (job.name === "company-discovery" && job.data.companyId) {
        const result = await discoverCompany(db, job.data.companyId, job.data.force);
        if ("sourceId" in result && result.sourceId && "imported" in result)
          await enqueueCompanyDiscovery(queue, db, result.sourceId);
        return result;
      }
      if (job.name === "test" && job.data.sourceId) {
        const source = await db.source.findUniqueOrThrow({ where: { id: job.data.sourceId } });
        const log = await db.importLog.create({ data: { sourceId: source.id, status: "RUNNING" } });
        try {
          const provider = getProvider(source.type);
          if (!provider.testConnection) throw new Error("Connection test unavailable for this provider");
          await provider.testConnection(source.sourceIdentifier);
          await db.importLog.update({ where: { id: log.id }, data: { status: "TEST_SUCCESS", finishedAt: new Date() } });
          return { connected: true };
        } catch (error) {
          await db.importLog.update({ where: { id: log.id }, data: {
            status: "TEST_FAILED", finishedAt: new Date(),
            error: error instanceof Error ? error.message.slice(0, 1000) : "Connection test failed",
          } });
          throw error;
        }
      }
      if (job.name !== "source" || !job.data.sourceId)
        throw new Error("Invalid sync job");
      const sourceId = job.data.sourceId;
      try {
        const result = await syncSource(db, sourceId);
        if ("found" in result) {
          await db.company.updateMany({ where: { discoverySourceId: sourceId,
            validationStatus: { in: ["CATALOG", "FAILED"] } },
            data: { discoveryStatus: "ENABLED", validationStatus: "VALID", discoveryError: null } });
          await enqueueCompanyDiscovery(queue, db, sourceId);
        }
        return result;
      } catch (error) {
        const source = await db.source.findUnique({ where: { id: sourceId }, select: { companyId: true } });
        // Rate limits and temporary provider outages must not disable a
        // source before BullMQ can retry it after the cooldown.
        if (source && !isTransientProviderError(error)) {
          const company = await db.company.findUnique({ where: { id: source.companyId },
            select: { validationStatus: true, discoverySourceId: true } });
          if (company?.discoverySourceId === sourceId &&
              ["CATALOG", "FAILED"].includes(company.validationStatus ?? "")) {
            const reason = error instanceof Error ? error.message.slice(0, 1000) : "Catalog source validation failed";
            await db.source.update({ where: { id: sourceId }, data: { enabled: false } });
            await db.company.update({ where: { id: source.companyId }, data: {
              discoveryStatus: "REVIEW", validationStatus: "FAILED", discoveryError: reason,
            } });
          }
        }
        throw error;
      }
    },
    { connection: redisConnection(), concurrency: 2 },
  );
  worker.on("completed", (job, result: unknown) =>
    console.log(
      JSON.stringify({
        event: "sync-completed",
        jobId: job.id,
        sourceId: job.data.sourceId,
        result,
      }),
    ),
  );
  worker.on("failed", (job, error) =>
    console.error(
      JSON.stringify({
        event: "sync-failed",
        jobId: job?.id,
        sourceId: job?.data.sourceId,
        error: error.message,
      }),
    ),
  );
  worker.on("error", (error) => console.error("Worker error:", error.message));
  let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
  let reconciling = false;
  let stopping = false;
  const scheduleReconciliation = () => {
    if (stopping) return;
    reconcileTimer = setTimeout(async () => {
      if (reconciling) return scheduleReconciliation();
      reconciling = true;
      try {
        const result = await reconcileVacancySyncScheduler(db, schedulerQueue);
        if (result.lastApplyError)
          console.error("Vacancy scheduler reconciliation failed:", result.lastApplyError);
      } catch (error) {
        console.error(
          "Vacancy scheduler reconciliation failed:",
          error instanceof Error ? error.message : error,
        );
      } finally {
        reconciling = false;
        scheduleReconciliation();
      }
    }, VACANCY_SYNC_RECONCILE_INTERVAL_MS);
    reconcileTimer.unref();
  };
  scheduleReconciliation();
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearTimeout(reconcileTimer);
    await worker.close();
    await schedulerQueue.close();
    await queue.close();
    await db.$disconnect();
  };
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
  console.log(
    `Sync worker ready; automatic imports ${syncConfig.enabled ? `every ${syncConfig.intervalHours} hours` : "disabled"}, daily cleanup, discovery and taxonomy maintenance enabled`,
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
