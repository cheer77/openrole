import { Queue } from "bullmq";
import { redisConnection } from "./config.js";
import type { PrismaClient } from "./generated/prisma/client.js";

export const queueName = "openrole-sync";
export function createQueue() {
  return new Queue<{ sourceId?: string }>(queueName, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export async function enqueueSources(
  queue: ReturnType<typeof createQueue>,
  db: PrismaClient,
  sourceId?: string,
) {
  const sources = await db.source.findMany({
    where: {
      enabled: true,
      type: { not: "MANUAL" },
      ...(sourceId ? { id: sourceId } : {}),
    },
    select: { id: true },
  });
  if (sourceId && sources.length === 0)
    throw new Error("Enabled import source not found");
  for (const source of sources) {
    await queue.add(
      "source",
      { sourceId: source.id },
      { deduplication: { id: source.id } },
    );
  }
  return sources.length;
}
