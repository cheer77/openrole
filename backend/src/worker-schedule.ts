import type { Queue } from "bullmq";

export const VACANCY_SYNC_INTERVAL_MS = 43_200_000;

// Keep the existing scheduler ID so BullMQ replaces the hourly schedule and
// its pending job instead of creating a second repeating schedule.
export const VACANCY_SYNC_SCHEDULER_ID = "hourly";

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
