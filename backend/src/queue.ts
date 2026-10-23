import { Queue } from "bullmq";
import { redisConnection } from "./config.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { dueDiscoveryCompanies } from "./discovery/index.js";
import { skipDeduplicatedRunSource } from "./sync-runs.js";

export const queueName = "openrole-sync";
export type SyncJobData = {
  sourceId?: string;
  companyId?: string;
  force?: boolean;
  runId?: string;
  syncRunSourceId?: string;
};
export function createQueue(options: { failFast?: boolean } = {}) {
  return new Queue<SyncJobData>(queueName, {
    connection: redisConnection(options.failFast),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export async function enqueueCompanyDiscovery(
  queue: ReturnType<typeof createQueue>, db: PrismaClient, sourceId?: string,
) {
  const companies = await dueDiscoveryCompanies(db, sourceId);
  for (const company of companies) await queue.add("company-discovery", { companyId: company.id }, {
    deduplication: { id: `discovery:${company.id}` },
  });
  return companies.length;
}

export async function enqueueSources(
  queue: ReturnType<typeof createQueue>,
  db: PrismaClient,
  sourceId?: string,
  run?: { id: string; sources: { id: string; sourceId: string }[] },
) {
  const sources = await db.source.findMany({
    where: {
      enabled: true,
      company: { enabled: true },
      type: { not: "MANUAL" },
      ...(sourceId ? { id: sourceId } : {}),
    },
    select: { id: true, type: true },
  });
  if (sourceId && sources.length === 0)
    throw new Error("Enabled import source not found");
  for (const source of sources) {
    const runSource = run?.sources.find((item) => item.sourceId === source.id);
    const job = await queue.add(
      "source",
      { sourceId: source.id, runId: run?.id, syncRunSourceId: runSource?.id },
      {
        ...(run ? { jobId: `sync-source-${run.id}-${source.id}` } : {}),
        deduplication: { id: source.id },
        // A 429 from Arbeitnow should not trigger another full pagination
        // one minute later. Other providers retain the default queue delay.
        ...(source.type === "ARBEITNOW" ? {
          backoff: { type: "exponential" as const, delay: 300000 },
        } : {}),
      },
    );
    if (runSource && job.data.syncRunSourceId !== runSource.id)
      await skipDeduplicatedRunSource(db, runSource.id);
  }
  return sources.length;
}
