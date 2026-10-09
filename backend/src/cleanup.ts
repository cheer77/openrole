import type { PrismaClient } from "./generated/prisma/client.js";

export const CLOSED_RETENTION_DAYS = 30;
const BATCH_SIZE = 500;

export async function cleanupClosedJobs(db: PrismaClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - CLOSED_RETENTION_DAYS * 86400000);
  let removed = 0;
  // A bounded run keeps the shared worker responsive. The next daily run resumes.
  for (let batch = 0; batch < 100; batch++) {
    const count = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; sourceId: string; externalId: string; slug: string; title: string; companyName: string }[]
      >`SELECT j.id, j."sourceId", j."externalId", j.slug, j.title, c.name AS "companyName"
         FROM "Job" j JOIN "Company" c ON c.id = j."companyId"
         WHERE j.status = 'CLOSED' AND j."closedAt" <= ${cutoff}
         ORDER BY j."closedAt", j.id LIMIT ${BATCH_SIZE}
         FOR UPDATE OF j SKIP LOCKED`;
      if (!rows.length) return 0;
      await tx.expiredJob.createMany({
        data: rows.map((row) => ({ ...row, deletedAt: now })),
        skipDuplicates: true,
      });
      await tx.job.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
      return rows.length;
    });
    removed += count;
    if (count < BATCH_SIZE) break;
  }
  return { removed, cutoff };
}
