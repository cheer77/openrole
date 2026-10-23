# Product

## Purpose
Help candidates find factual vacancies from employer ATS and approved aggregate feeds; give the owner a private operational workspace.

## Current implementation
Public search, filters, company/job/SEO pages, safe outbound apply links, privacy-conscious analytics, owner CRUD/review tools, source imports, dynamic automatic scheduling, manual global synchronization and run monitoring.

## Architecture and data flow
Next.js renders public/admin UI → server adapters and BFF call NestJS → Prisma reads/writes PostgreSQL. BullMQ/Redis dispatches import work; PostgreSQL remains authoritative.

## Main components
`app/`, `components/`, `features/jobs/`, `features/admin/`, `backend/src/app.ts`, `backend/src/admin.ts`, `backend/src/control-center.ts`, `backend/src/worker.ts`.

## Constraints
Do not invent vacancy facts, geography, compensation or employer eligibility. Imports preserve manual overrides, deletion tombstones and provenance. Owner actions are private and audited.

## Known limitations
Candidate/employer accounts, OAuth, saved jobs and alerts are UI previews. Apply conversion records clicks, not completed applications. Some feeds expose incomplete historical data.

## Related files
`README.md`, `backend/README.md`, `docs/specs/job-synchronization.md`, `docs/specs/security.md`.
