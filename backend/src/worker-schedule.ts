import type { Queue } from "bullmq";
import { z } from "zod";
import type {
  Prisma,
  PrismaClient,
  VacancySyncConfig,
} from "./generated/prisma/client.js";

export const VACANCY_SYNC_INTERVAL_HOURS = [1, 3, 6, 12, 24] as const;
export const VACANCY_SYNC_DEFAULT_INTERVAL_HOURS = 12;
export const VACANCY_SYNC_INTERVAL_MS =
  VACANCY_SYNC_DEFAULT_INTERVAL_HOURS * 3_600_000;

// This legacy ID must remain stable: changing it would leave the existing
// scheduler behind and create duplicate automatic imports.
export const VACANCY_SYNC_SCHEDULER_ID = "hourly";
export const VACANCY_SYNC_CONFIG_ID = "vacancy-sync";
export const VACANCY_SYNC_RECONCILE_INTERVAL_MS = 5 * 60_000;

export const vacancySyncUpdateSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.union([
    z.literal(1), z.literal(3), z.literal(6), z.literal(12), z.literal(24),
  ]),
  revision: z.number().int().min(1),
}).strict();

type SchedulerQueue = Pick<
  Queue,
  "getJobScheduler" | "upsertJobScheduler" | "removeJobScheduler"
>;
type Db = PrismaClient | Prisma.TransactionClient;

export class StaleVacancySyncRevisionError extends Error {
  constructor(readonly currentRevision: number) {
    super("Synchronization settings changed in another session");
  }
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Scheduler update failed").slice(0, 1000);
}

export async function ensureVacancySyncConfig(db: Db) {
  return db.vacancySyncConfig.upsert({
    where: { id: VACANCY_SYNC_CONFIG_ID },
    create: { id: VACANCY_SYNC_CONFIG_ID },
    update: {},
  });
}

async function lockVacancySyncConfig(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`
    SELECT "id" FROM "VacancySyncConfig"
    WHERE "id" = ${VACANCY_SYNC_CONFIG_ID}
    FOR UPDATE
  `;
  return tx.vacancySyncConfig.findUniqueOrThrow({
    where: { id: VACANCY_SYNC_CONFIG_ID },
  });
}

export async function updateVacancySyncConfig(
  db: PrismaClient,
  input: z.infer<typeof vacancySyncUpdateSchema>,
  now = new Date(),
) {
  await ensureVacancySyncConfig(db);
  return db.$transaction(async (tx) => {
    const current = await lockVacancySyncConfig(tx);
    if (current.revision !== input.revision)
      throw new StaleVacancySyncRevisionError(current.revision);
    if (
      current.enabled === input.enabled &&
      current.intervalHours === input.intervalHours
    ) return current;

    const updated = await tx.vacancySyncConfig.update({
      where: { id: VACANCY_SYNC_CONFIG_ID },
      data: {
        enabled: input.enabled,
        intervalHours: input.intervalHours,
        revision: { increment: 1 },
        nextRunAt: input.enabled
          ? new Date(now.getTime() + input.intervalHours * 3_600_000)
          : null,
        lastApplyError: null,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        action: "VACANCY_SYNC_SETTINGS_CHANGED",
        entityType: "sync-configuration",
        entityId: VACANCY_SYNC_CONFIG_ID,
        details: {
          enabled: input.enabled,
          intervalHours: input.intervalHours,
          revision: updated.revision,
        },
      },
    });
    return updated;
  });
}

export async function applyVacancySyncScheduler(
  queue: SchedulerQueue,
  config: VacancySyncConfig,
  now = Date.now(),
) {
  const current = await queue.getJobScheduler(VACANCY_SYNC_SCHEDULER_ID);
  if (!config.enabled) {
    if (current) await queue.removeJobScheduler(VACANCY_SYNC_SCHEDULER_ID);
    return undefined;
  }

  const every = config.intervalHours * 3_600_000;
  const matches = current?.name === "all" && current.every === every;
  const adoptsLegacySchedule =
    config.revision === 1 && config.appliedRevision === 0 && matches;
  const revisionNeedsApply =
    config.appliedRevision !== config.revision && !adoptsLegacySchedule;

  if (!matches || revisionNeedsApply) {
    const savedNext = config.nextRunAt?.getTime();
    const startDate = revisionNeedsApply && savedNext
      ? Math.max(savedNext, now)
      : now + every;
    await queue.upsertJobScheduler(
      VACANCY_SYNC_SCHEDULER_ID,
      { every, startDate },
      { name: "all", data: {} },
    );
    return queue.getJobScheduler(VACANCY_SYNC_SCHEDULER_ID);
  }
  return current;
}

export async function reconcileVacancySyncScheduler(
  db: PrismaClient,
  queue: SchedulerQueue,
  now = new Date(),
) {
  await ensureVacancySyncConfig(db);
  return db.$transaction(async (tx) => {
    const config = await lockVacancySyncConfig(tx);
    try {
      const scheduler = await applyVacancySyncScheduler(queue, config, now.getTime());
      return tx.vacancySyncConfig.update({
        where: { id: VACANCY_SYNC_CONFIG_ID },
        data: {
          appliedRevision: config.revision,
          nextRunAt: config.enabled && scheduler?.next
            ? new Date(scheduler.next)
            : null,
          lastApplyError: null,
        },
      });
    } catch (error) {
      return tx.vacancySyncConfig.update({
        where: { id: VACANCY_SYNC_CONFIG_ID },
        data: { lastApplyError: errorMessage(error) },
      });
    }
  }, { maxWait: 5000, timeout: 30000 });
}

export async function vacancySyncState(db: PrismaClient, queue: SchedulerQueue) {
  const config = await ensureVacancySyncConfig(db);
  try {
    const scheduler = await queue.getJobScheduler(VACANCY_SYNC_SCHEDULER_ID);
    const matches = config.enabled
      ? scheduler?.name === "all" &&
        scheduler.every === config.intervalHours * 3_600_000
      : !scheduler;
    const applied = config.appliedRevision === config.revision && matches;
    return {
      enabled: config.enabled,
      intervalHours: config.intervalHours,
      revision: config.revision,
      appliedRevision: config.appliedRevision,
      saved: true,
      applied,
      lastApplyError: config.lastApplyError,
      scheduler: {
        status: config.lastApplyError && !applied
          ? "error"
          : applied
            ? config.enabled ? "active" : "disabled"
            : "pending",
        nextRunAt: config.enabled && scheduler?.next
          ? new Date(scheduler.next)
          : null,
        intervalHours: scheduler?.every
          ? scheduler.every / 3_600_000
          : null,
        error: null,
      },
    };
  } catch (error) {
    return {
      enabled: config.enabled,
      intervalHours: config.intervalHours,
      revision: config.revision,
      appliedRevision: config.appliedRevision,
      saved: true,
      applied: false,
      lastApplyError: config.lastApplyError,
      scheduler: {
        status: "unavailable",
        nextRunAt: null,
        intervalHours: null,
        error: errorMessage(error),
      },
    };
  }
}

// Retained for the narrow legacy unit contract; production startup reconciles
// from PostgreSQL through reconcileVacancySyncScheduler.
export async function configureVacancySyncScheduler(
  queue: Pick<Queue, "getJobScheduler" | "upsertJobScheduler">,
  now = Date.now(),
) {
  const currentScheduler = await queue.getJobScheduler(VACANCY_SYNC_SCHEDULER_ID);
  const startDate = currentScheduler?.next ?? now + VACANCY_SYNC_INTERVAL_MS;
  await queue.upsertJobScheduler(
    VACANCY_SYNC_SCHEDULER_ID,
    { every: VACANCY_SYNC_INTERVAL_MS, startDate },
    { name: "all", data: {} },
  );
}
