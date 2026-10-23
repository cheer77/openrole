# Backend agent guide

This directory contains the NestJS API, Prisma schema/migrations, provider adapters, BullMQ queue, and worker. Read `../docs/specs/backend.md`, plus `database.md`, `api.md`, or `job-synchronization.md` when relevant.

- Controllers validate with Zod, return explicit HTTP errors, and keep owner endpoints behind `OwnerGuard`. Owner mutations require `AdminAuditLog` entries and Next BFF allowlisting.
- PostgreSQL is authoritative. Use transactions and row/advisory locks for cross-process invariants; never rely on in-memory locks for multi-replica correctness.
- Keep one `openrole-sync` queue and the stable vacancy scheduler ID `hourly`. Preserve source job deduplication and `syncSource` advisory locks. Removing a scheduler must never remove active jobs.
- Treat Redis as fallible. Control-plane commands fail fast; durable intent/error state belongs in PostgreSQL and startup/low-frequency reconciliation repairs drift.
- A global `SyncRun` finishes only after all `SyncRunSource` rows are terminal. The `all` job is fan-out, not completion. A deduplicated/skipped source is never counted as success without a result.
- Provider snapshots must be complete and validated before reconciliation. Do not weaken tombstones, manual/status overrides, absence tracking, or transient-provider retry behavior.
- Add forward-only Prisma migrations; inspect SQL and test on an explicit `*_test` database. Never reset or migrate production without authorization.
- Keep logs bounded and free of secrets/raw personal data. Preserve privacy retention and sanitized errors.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and relevant integration tests. Queue changes require concurrency, retry, deduplication, restart, Redis-failure, and disabled-scheduler coverage.
