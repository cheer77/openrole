---
name: backend-development
description: Implement or review VmiYou NestJS controllers, domain services, provider integrations, validation, authorization, and backend error handling.
---

# Backend development

1. Read `backend/AGENTS.md`, `docs/specs/backend.md`, and the relevant API/database/synchronization spec.
2. Extend an existing controller/domain boundary; do not introduce a parallel service pattern for a local change.
3. Validate external input with Zod and map expected failures to explicit HTTP status codes. Owner routes require OwnerGuard, BFF allowlisting and audit logging for mutations.
4. Keep transactions sufficient for shared invariants; preserve provider snapshot validation, retry classification and provenance.
5. Add unit tests for pure rules and integration tests for database/API behavior.
6. Run backend generate, lint, typecheck, unit and relevant integration tests.

For queue/worker work, use the worker-scheduler skill.
