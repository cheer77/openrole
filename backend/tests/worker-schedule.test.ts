import { test } from "node:test";
import assert from "node:assert/strict";
import type { Queue } from "bullmq";
import {
  applyVacancySyncScheduler,
  configureVacancySyncScheduler,
  VACANCY_SYNC_DEFAULT_INTERVAL_HOURS,
  VACANCY_SYNC_INTERVAL_MS,
  VACANCY_SYNC_INTERVAL_HOURS,
  VACANCY_SYNC_SCHEDULER_ID,
  vacancySyncUpdateSchema,
} from "../src/worker-schedule.js";
import type { VacancySyncConfig } from "../src/generated/prisma/client.js";

const config = (overrides: Partial<VacancySyncConfig> = {}): VacancySyncConfig => ({
  id: "vacancy-sync",
  enabled: true,
  intervalHours: 12,
  revision: 1,
  appliedRevision: 0,
  nextRunAt: null,
  lastApplyError: null,
  updatedAt: new Date(0),
  ...overrides,
});

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

test("dynamic scheduler defaults to 12 hours and accepts only supported intervals", () => {
  assert.equal(VACANCY_SYNC_DEFAULT_INTERVAL_HOURS, 12);
  assert.deepEqual(VACANCY_SYNC_INTERVAL_HOURS, [1, 3, 6, 12, 24]);
  for (const intervalHours of VACANCY_SYNC_INTERVAL_HOURS)
    assert.equal(vacancySyncUpdateSchema.safeParse({ enabled: true, intervalHours, revision: 1 }).success, true);
  for (const intervalHours of [0, 2, 4, 48, "12"])
    assert.equal(vacancySyncUpdateSchema.safeParse({ enabled: true, intervalHours, revision: 1 }).success, false);
});

test("a new revision replaces the same scheduler from the saved next run", async () => {
  const calls: unknown[][] = [];
  const now = Date.UTC(2026, 9, 23, 10);
  const nextRunAt = new Date(now + 6 * 3_600_000);
  let scheduler = { key: "hourly", name: "all", every: 43_200_000, next: now + 1_000 };
  const queue = {
    async getJobScheduler() { return scheduler; },
    async upsertJobScheduler(...args: unknown[]) {
      calls.push(args);
      scheduler = { key: "hourly", name: "all", every: 21_600_000, next: nextRunAt.getTime() };
    },
    async removeJobScheduler() { return true; },
  } as unknown as Pick<Queue, "getJobScheduler" | "upsertJobScheduler" | "removeJobScheduler">;

  const result = await applyVacancySyncScheduler(queue, config({
    intervalHours: 6, revision: 2, appliedRevision: 1, nextRunAt,
  }), now);

  assert.deepEqual(calls, [[
    "hourly",
    { every: 21_600_000, startDate: nextRunAt.getTime() },
    { name: "all", data: {} },
  ]]);
  assert.equal(result?.next, nextRunAt.getTime());
});

test("disabling removes only the stable scheduler and enabling recreates it", async () => {
  const removed: string[] = [];
  let scheduler: { key: string; name: string; every: number; next: number } | undefined = {
    key: "hourly", name: "all", every: 43_200_000, next: Date.now() + 1000,
  };
  const queue = {
    async getJobScheduler() { return scheduler; },
    async removeJobScheduler(id: string) { removed.push(id); scheduler = undefined; return true; },
    async upsertJobScheduler(id: string, repeat: { every: number; startDate?: number }) {
      scheduler = { key: id, name: "all", every: repeat.every, next: repeat.startDate! };
    },
  } as unknown as Pick<Queue, "getJobScheduler" | "upsertJobScheduler" | "removeJobScheduler">;

  await applyVacancySyncScheduler(queue, config({ enabled: false }));
  assert.deepEqual(removed, [VACANCY_SYNC_SCHEDULER_ID]);
  const nextRunAt = new Date(Date.now() + 3_600_000);
  await applyVacancySyncScheduler(queue, config({
    intervalHours: 1, revision: 2, appliedRevision: 1, nextRunAt,
  }), nextRunAt.getTime() - 3_600_000);
  assert.equal(scheduler?.every, 3_600_000);
});

test("startup adopts the existing compatible scheduler without duplicating it", async () => {
  let upserts = 0;
  const current = { key: "hourly", name: "all", every: 43_200_000, next: Date.now() + 1000 };
  const queue = {
    async getJobScheduler() { return current; },
    async upsertJobScheduler() { upserts++; },
    async removeJobScheduler() { return true; },
  } as unknown as Pick<Queue, "getJobScheduler" | "upsertJobScheduler" | "removeJobScheduler">;
  assert.equal(await applyVacancySyncScheduler(queue, config()), current);
  assert.equal(upserts, 0);
});
