# Security

## Purpose
Capture trust boundaries, authorization and privacy rules.

## Current implementation
Owner passwords are scrypt hashes. Sessions use random 256-bit tokens whose hashes are stored in PostgreSQL; cookies are HttpOnly and SameSite=Strict. BFF mutations validate Origin; Nest owner routes use OwnerGuard. Internal API keys protect login/events. Inputs use Zod. Analytics excludes raw IP and sensitive interaction content and honors privacy controls.

## Architecture and data flow
Secrets remain server-side environment values. Browser admin requests terminate at the Next BFF; only exact allowed routes are forwarded. Provider identifiers are constrained to known hosts/formats. Database transactions and locks enforce concurrency boundaries.

## Main components
`backend/src/admin-auth.ts`, `admin.ts`, `security.ts`, `analytics.ts`, `lib/admin/`, `app/api/`, `.env.example` files.

## Constraints
Never log/store secrets, raw IP, passwords or full sensitive URLs. Keep owner APIs guarded twice, validate external URLs and avoid SSRF. Production requires HTTPS, secure cookies and exact origins.

## Known limitations
Process-local rate limiting is unsuitable for multiple API replicas until moved to Redis.

## Related files
`docs/specs/api.md`, `deployment.md`, `.agents/skills/security-review/SKILL.md`.
