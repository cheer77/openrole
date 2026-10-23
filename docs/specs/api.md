# API

## Purpose
Document current contract families and mutation rules.

## Current implementation
Public endpoints expose jobs, companies and SEO feeds. Internal-key endpoints accept owner login and privacy-bounded events. Owner endpoints under `/admin` require `OwnerGuard`; the Next BFF separately allowlists exact read/mutation paths.

Synchronization endpoints: `GET /admin/sync`, `PATCH /admin/sync`, `POST /admin/sync/run`, `GET /admin/sync/runs?page=N`, and `GET /admin/sync/runs/:id`. Concurrent settings or run acquisition returns 409; invalid input returns 400; unavailable queueing returns 503.

## Architecture and data flow
Browser → Next route handler → Nest API with internal credential/owner token → Zod validation → Prisma/Redis. Backend routes are not made public by a wildcard proxy.

## Main components
`backend/src/app.ts`, `admin.ts`, `control-center.ts`, `admin-auth.ts`, `app/api/`, `lib/admin/routes.ts`, `lib/admin/server.ts`.

## Constraints
Validate bodies/query/path values, preserve meaningful status codes, audit owner mutations, never return secrets or raw IP, and update this file plus allowlist/tests for contract changes.

## Known limitations
No public partner-ingestion API and no candidate/employer account API.

## Related files
`docs/specs/security.md`, `admin-panel.md`, `job-synchronization.md`.
