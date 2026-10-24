import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client.js";

const optionsSchema = z.object({
  apply: z.boolean(),
  confirmDatabase: z.string().trim().min(1).optional(),
  confirmCount: z.number().int().nonnegative().optional(),
}).superRefine((options, context) => {
  if (options.apply && !options.confirmDatabase)
    context.addIssue({ code: "custom", path: ["confirmDatabase"], message: "required with --apply" });
  if (options.apply && options.confirmCount === undefined)
    context.addIssue({ code: "custom", path: ["confirmCount"], message: "required with --apply" });
});

export function parseCleanupOptions(args: string[]) {
  const values: { apply: boolean; confirmDatabase?: string; confirmCount?: number } = { apply: false };
  for (const argument of args) {
    if (argument === "--apply") values.apply = true;
    else if (argument.startsWith("--confirm-database="))
      values.confirmDatabase = argument.slice("--confirm-database=".length);
    else if (argument.startsWith("--confirm-count="))
      values.confirmCount = Number(argument.slice("--confirm-count=".length));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return optionsSchema.parse(values);
}

type CandidateCount = { count: bigint };
type StatusCount = { status: string; count: bigint };

async function candidateSummary(db: PrismaClient) {
  const [database] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const [total] = await db.$queryRaw<CandidateCount[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Job" j JOIN "Source" s ON s.id = j."sourceId"
    WHERE s.type = 'LEVER' AND j."publishedAt" IS NOT NULL AND NOT j."manualOverride"`;
  const byStatus = await db.$queryRaw<StatusCount[]>`
    SELECT j.status::text AS status, COUNT(*)::bigint AS count
    FROM "Job" j JOIN "Source" s ON s.id = j."sourceId"
    WHERE s.type = 'LEVER' AND j."publishedAt" IS NOT NULL AND NOT j."manualOverride"
    GROUP BY j.status ORDER BY j.status`;
  const [manual] = await db.$queryRaw<CandidateCount[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Job" j JOIN "Source" s ON s.id = j."sourceId"
    WHERE s.type = 'LEVER' AND j."publishedAt" IS NOT NULL AND j."manualOverride"`;
  return {
    database: database?.name ?? "",
    count: Number(total?.count ?? 0n),
    byStatus: Object.fromEntries(byStatus.map((item) => [item.status, Number(item.count)])),
    manualOverridesExcluded: Number(manual?.count ?? 0n),
  };
}

export async function clearLeverPublishedAt(
  db: PrismaClient,
  options: ReturnType<typeof parseCleanupOptions>,
  now = new Date(),
) {
  const summary = await candidateSummary(db);
  if (!options.apply) return { mode: "dry-run" as const, ...summary };
  if (summary.database !== options.confirmDatabase)
    throw new Error(`Database confirmation mismatch: connected to ${summary.database}`);
  if (summary.count !== options.confirmCount)
    throw new Error(`Candidate count changed: expected ${options.confirmCount}, found ${summary.count}`);

  const updated = await db.$transaction(async (tx) => {
    const sources = await tx.source.findMany({
      where: { type: "LEVER", jobs: { some: { publishedAt: { not: null }, manualOverride: false } } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    let count = 0;
    for (const source of sources) {
      const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${source.id})) AS locked`;
      if (!lock?.locked) throw new Error(`Lever source ${source.id} is currently syncing`);
      count += await tx.$executeRaw`
        UPDATE "Job"
        SET "publishedAt" = NULL,
            "sortDate" = "firstSeenAt",
            "contentUpdatedAt" = CASE WHEN status = 'ACTIVE' THEN ${now} ELSE "contentUpdatedAt" END,
            "updatedAt" = ${now}
        WHERE "sourceId" = ${source.id}
          AND "publishedAt" IS NOT NULL
          AND NOT "manualOverride"`;
    }
    if (count !== options.confirmCount)
      throw new Error(`Candidate count changed after locking: expected ${options.confirmCount}, found ${count}`);
    return count;
  }, { maxWait: 5000, timeout: 30000 });

  return { mode: "apply" as const, ...summary, updated };
}

async function main() {
  const options = parseCleanupOptions(process.argv.slice(2));
  await import("dotenv/config");
  const { createDb } = await import("../db.js");
  const db = createDb();
  try {
    const result = await clearLeverPublishedAt(db, options);
    console.log(JSON.stringify(result, null, 2));
    if (!options.apply)
      console.log("Dry run only. Re-run with --apply, --confirm-database and --confirm-count to write changes.");
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
