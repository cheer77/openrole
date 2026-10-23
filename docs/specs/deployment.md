# Deployment

## Purpose
Describe topology and safe release/rollback procedures without embedding provider secrets.

## Current implementation
Frontend is deployable independently from Nest API and worker. PostgreSQL and Redis are shared infrastructure. Local Docker Compose starts PostgreSQL, Redis, API and worker; API runs migrations before startup. Production settings are managed outside the repository.

## Architecture and data flow
Public traffic → frontend → Nest API → PostgreSQL. API/worker enqueue and consume Redis jobs. Worker startup reconciles scheduler state from PostgreSQL.

## Main components
`compose.yaml`, `backend/Dockerfile`, root/backend package scripts, `.env.example`, Prisma migrations.

## Constraints
Back up DB; review/apply forward migration before new API/worker code that requires it; deploy API and worker at the same platform version; verify health, single `hourly` scheduler and run endpoints. Never mutate Railway/Vercel or production data without explicit authorization. Roll back application code only after checking schema compatibility; additive run tables may remain.

## Known limitations
Repository does not encode the live Railway/Vercel settings or secret store.

## Related files
`docs/specs/testing.md`, `database.md`, `job-synchronization.md`, `.agents/skills/deployment-review/SKILL.md`.
