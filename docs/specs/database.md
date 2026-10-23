# Database

## Purpose
Define PostgreSQL ownership, important Prisma models and safe schema evolution.

## Current implementation
`Company`, `Source`, `Job`, `ExpiredJob` and `DeletedJob` hold catalog/provenance. `ImportLog` records source attempts. `VacancySyncConfig` is the singleton scheduler configuration. `SyncRun` and `SyncRunSource` track global runs and link to their `ImportLog` attempts. Admin, analytics and integration models are separate.

## Architecture and data flow
Prisma Client is generated into `backend/src/generated/prisma`. Transactions protect snapshot reconciliation and global-run state. PostgreSQL advisory locks serialize each source and global run acquisition.

## Main components
`backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/src/db.ts`, `backend/src/sync.ts`, `backend/src/sync-runs.ts`.

## Constraints
Use forward-only reviewed migrations; never use schema push for production. Preserve unique source provenance, job tombstones and indexes used by listing/retention. Test only against an explicit database whose name ends `_test`.

## Known limitations
Run statistics are stored as counters for operational display, not as an analytics warehouse. Historical raw analytics has bounded retention.

## Related files
`docs/specs/job-synchronization.md`, `security.md`, `deployment.md`.
