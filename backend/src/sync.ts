import { createHash } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client.js";
import { getProvider, type JobProvider } from "./providers/providers.js";
import { normalizedJobSchema } from "./providers/normalize.js";

export function jobSlug(title: string, sourceId: string, externalId: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "job";
  const hash = createHash("sha256")
    .update(JSON.stringify([sourceId, externalId]))
    .digest("hex")
    .slice(0, 20);
  return `${base}-${hash}`;
}

export async function syncSource(
  db: PrismaClient,
  sourceId: string,
  provider?: JobProvider,
  now = new Date(),
) {
  try {
    return await db.$transaction(
      async (tx) => {
        const locks = await tx.$queryRaw<
          { locked: boolean }[]
        >`SELECT pg_try_advisory_xact_lock(hashtext(${sourceId})) AS locked`;
        if (!locks[0]?.locked) return { skipped: true };
        const source = await tx.source.findUniqueOrThrow({
          where: { id: sourceId },
        });
        if (!source.enabled || source.type === "MANUAL")
          return { skipped: true };
        const jobs = (
          await (provider ?? getProvider(source.type)).fetch(
            source.sourceIdentifier,
          )
        ).map((job) => normalizedJobSchema.parse(job));
        const ids = jobs.map((job) => job.externalId);
        if (new Set(ids).size !== ids.length)
          throw new Error(
            "Duplicate external IDs: snapshot is not safe to reconcile",
          );
        const existing = await tx.job.findMany({
          where: { sourceId },
          select: {
            externalId: true,
            status: true,
            publishedAt: true,
            firstSeenAt: true,
          },
        });
        const byId = new Map(existing.map((job) => [job.externalId, job]));
        let created = 0;
        let updated = 0;
        for (const job of jobs) {
          const old = byId.get(job.externalId);
          const publishedAt = job.publishedAt ?? old?.publishedAt ?? null;
          const values = {
            ...job,
            publishedAt,
            sortDate: publishedAt ?? old?.firstSeenAt ?? now,
            lastCheckedAt: now,
            missingSince: null,
            companyId: source.companyId,
          };
          await tx.job.upsert({
            where: {
              sourceId_externalId: { sourceId, externalId: job.externalId },
            },
            create: {
              ...values,
              sourceId,
              slug: jobSlug(job.title, sourceId, job.externalId),
              firstSeenAt: now,
            },
            update: {
              ...values,
              status: old?.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
            },
          });
          if (old) updated++;
          else created++;
        }
        // Only a complete validated snapshot can start/advance absence tracking.
        // A second confirmation at least 24h later is required, including an empty board.
        const absent = {
          sourceId,
          status: "ACTIVE" as const,
          externalId: { notIn: ids },
        };
        const closed = await tx.job.updateMany({
          where: {
            ...absent,
            missingSince: { lte: new Date(now.getTime() - 86400000) },
          },
          data: { status: "CLOSED" },
        });
        await tx.job.updateMany({
          where: { ...absent, missingSince: null },
          data: { missingSince: now },
        });
        await tx.source.update({
          where: { id: sourceId },
          data: { lastSyncAt: now, lastSuccessfulSync: now, lastError: null },
        });
        return { found: jobs.length, created, updated, closed: closed.count };
      },
      { maxWait: 5000, timeout: 300000 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 1000) : "Import failed";
    await db.source.updateMany({
      where: {
        id: sourceId,
        OR: [
          { lastSuccessfulSync: null },
          { lastSuccessfulSync: { lte: now } },
        ],
      },
      data: { lastSyncAt: now, lastError: message },
    });
    throw error;
  }
}
