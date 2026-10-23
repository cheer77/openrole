---
name: worker-scheduler
description: Change or audit VmiYou Redis/BullMQ queues, vacancy scheduling, source imports, global SyncRun tracking, retry, recovery, deduplication, or worker concurrency.
---

# Worker and scheduler

1. Read `backend/AGENTS.md` and `docs/specs/job-synchronization.md`; inspect `queue.ts`, `worker.ts`, `worker-schedule.ts`, `sync-runs.ts` and `sync.ts` as needed.
2. Keep the single `openrole-sync` pipeline and scheduler ID `hourly`. PostgreSQL stores durable intent/run state; Redis performs delivery.
3. Preserve source deduplication and advisory locks. Acquire global runs transactionally; `all` only fans out.
4. Attribute only actual terminal source results. Handle deduplication, retries, stale runs, Redis outage and multi-worker races without false success.
5. Manual runs must not shift automatic scheduling; never remove active jobs or launch production imports.
6. Test disabled scheduling, no duplicates, restart persistence, Redis recovery, retries and concurrent acquisition; update the synchronization spec.
