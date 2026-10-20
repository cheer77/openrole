import { test } from "node:test";
import assert from "node:assert/strict";
import type { Queue } from "bullmq";
import {
  configureVacancySyncScheduler,
  VACANCY_SYNC_INTERVAL_MS,
  VACANCY_SYNC_SCHEDULER_ID,
} from "../src/worker-schedule.js";

test("vacancy sync replaces the hourly scheduler with one 12-hour schedule", async () => {
  const calls: unknown[][] = [];
  const nextScheduledRun = Date.UTC(2026, 9, 20, 14, 26);
  const queue = {
    async getJobScheduler() {
      return { next: nextScheduledRun };
    },
    async upsertJobScheduler(...args: unknown[]) {
      calls.push(args);
      return undefined;
    },
  } as unknown as Pick<Queue, "getJobScheduler" | "upsertJobScheduler">;

  await configureVacancySyncScheduler(queue);

  assert.equal(VACANCY_SYNC_SCHEDULER_ID, "hourly");
  assert.equal(VACANCY_SYNC_INTERVAL_MS, 43_200_000);
  assert.deepEqual(calls, [[
    "hourly",
    { every: 43_200_000, startDate: nextScheduledRun },
    { name: "all", data: {} },
  ]]);
  assert.notEqual(VACANCY_SYNC_INTERVAL_MS, 3_600_000);
});

test("vacancy sync waits 12 hours when no prior scheduler exists", async () => {
  const calls: unknown[][] = [];
  const now = Date.UTC(2026, 9, 20, 12);
  const queue = {
    async getJobScheduler() {
      return undefined;
    },
    async upsertJobScheduler(...args: unknown[]) {
      calls.push(args);
      return undefined;
    },
  } as unknown as Pick<Queue, "getJobScheduler" | "upsertJobScheduler">;

  await configureVacancySyncScheduler(queue, now);

  assert.deepEqual(calls, [[
    "hourly",
    { every: 43_200_000, startDate: now + 43_200_000 },
    { name: "all", data: {} },
  ]]);
});
