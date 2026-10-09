import { retainData } from "./analytics.js";
import { Worker } from "bullmq";
import { createDb } from "./db.js";
import { createQueue, enqueueSources, queueName } from "./queue.js";
import { redisConnection } from "./config.js";
import { syncSource } from "./sync.js";
import { cleanupClosedJobs } from "./cleanup.js";

async function main() {
  const db = createDb();
  await db.$connect();
  const queue = createQueue();
  await queue.setGlobalConcurrency(2);
  await queue.upsertJobScheduler(
    "hourly",
    { every: 3600000 },
    { name: "all", data: {} },
  );
  await queue.upsertJobScheduler(
    "daily-cleanup",
    { every: 86400000 },
    { name: "cleanup", data: {} },
  );
  const worker = new Worker<{ sourceId?: string }>(
    queueName,
    async (job) => {
      if (job.name === "all") {
        await retainData(db);
        return { queued: await enqueueSources(queue, db) };
      }
      if (job.name === "cleanup") return cleanupClosedJobs(db);
      if (job.name !== "source" || !job.data.sourceId)
        throw new Error("Invalid sync job");
      return syncSource(db, job.data.sourceId);
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
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await worker.close();
    await queue.close();
    await db.$disconnect();
  };
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
  console.log("Sync worker ready; hourly imports and daily cleanup enabled");
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
