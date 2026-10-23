# Backend

## Purpose
Describe the NestJS API, import providers and asynchronous worker.

## Current implementation
One Nest application exposes public catalog, internal event/auth and owner endpoints. Prisma accesses PostgreSQL. Provider adapters normalize ATS/API/XML data. One BullMQ worker executes import, cleanup, discovery, taxonomy and global-sync jobs.

## Architecture and data flow
Controllers validate input → services/helpers apply domain rules → Prisma transactions persist state. Queue producers add typed jobs to `openrole-sync`; `worker.ts` routes by job name and calls existing domain functions.

## Main components
`src/app.ts`, `admin.ts`, `control-center.ts`, `sync.ts`, `queue.ts`, `worker.ts`, `sync-runs.ts`, `worker-schedule.ts`, `providers/`, `discovery/`.

## Constraints
Zod at boundaries, explicit HTTP errors, OwnerGuard for owner APIs, transactions/locks for shared invariants, sanitized logs, bounded retries and no parallel import pipeline.

## Known limitations
API rate limits are process-local and must move to Redis before horizontal API scaling. Worker concurrency is intentionally two.

## Related files
`backend/AGENTS.md`, `backend/README.md`, `docs/specs/database.md`, `api.md`, `job-synchronization.md`.
