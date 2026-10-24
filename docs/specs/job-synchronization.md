# Job synchronization

## Purpose
Define the only supported vacancy import pipeline, scheduling, tracking and recovery invariants.

## Current implementation
BullMQ queue `openrole-sync` uses stable scheduler ID `hourly`. PostgreSQL singleton `VacancySyncConfig` controls enabled state and 1/3/6/12/24-hour interval. Manual and automatic global imports use the same `all` fan-out and `source` processor. `SyncRun`/`SyncRunSource` track trigger, progress, outcome and vacancy counters.

## Architecture and data flow
Scheduler/manual API → `all` job → atomic global run acquisition → enabled non-MANUAL sources → deduplicated `source` jobs → `syncSource` transaction/advisory lock → linked `ImportLog` → terminal source row → transactionally aggregated run. Completing `all` never completes the run.

## Reliability and constraints
Only one QUEUED/RUNNING global run is acquired under a PostgreSQL advisory lock. Source deduplication and advisory locks remain authoritative. A deduplicated or locked source becomes SKIPPED/PARTIAL, never false SUCCESS. Retries update the same source row; final failure closes it. Worker startup and five-minute scheduler reconciliation also interrupt runs older than 24 hours. Redis control operations fail fast; scheduler drift/error persists in PostgreSQL. Disabling automatic sync removes only the repeat scheduler and does not block manual runs or active jobs.

Provider adapters absorb expected publication races without weakening snapshot validation: a posting confirmed removed, inactive or internal may be omitted, while malformed identities, unsafe URLs, incomplete payloads and provider outages fail the snapshot. A changing paginated listing receives bounded in-adapter retries and remains transient for worker retry/initial-source validation.

Provider geography normalization accepts verified two-letter country codes and exact supported country names, storing ISO codes for structured locations. It does not infer a country from a city alone.

Publication dates are accepted from provider fields with documented publication semantics: Greenhouse `first_published`, Ashby `publishedAt`, SmartRecruiters `releasedDate`, Recruitee `published_at`, USAJOBS `PublicationStartDate`, and Canada Job Bank `First Posting Date`. Update timestamps and Lever posting-record creation timestamps are not treated as publication dates. The Arbeitnow adapter retains its existing `created_at` mapping, but the public feed documentation does not define whether that timestamp is the original upstream publication time. Lever's explicit country code and recognizable countries in `allLocations`, plus Ashby's primary and secondary addresses, are retained as structured locations.

Legacy Lever `publishedAt` values are not retained when a current import has no verified publication date. The one-off `maintenance:clear-lever-published-at` command audits all non-manually-overridden Lever rows in dry-run mode by default. Applying it requires exact database-name and candidate-count confirmations, acquires each source advisory lock, clears only `publishedAt`, resets `sortDate` to `firstSeenAt`, and refreshes active rows' `contentUpdatedAt` so sitemap `lastmod` reflects the public-page change.

## Main components
`backend/src/worker-schedule.ts`, `sync-runs.ts`, `queue.ts`, `worker.ts`, `sync.ts`, `control-center.ts`, Prisma models/migrations, Admin System UI.

## Known limitations
Progress is source-granular, not per-vacancy streaming. A process crash may leave a run active until BullMQ retries or the 24-hour stale reconciliation threshold.

## Related files
`docs/specs/database.md`, `api.md`, `deployment.md`, `.agents/skills/worker-scheduler/SKILL.md`.
