---
name: database-management
description: Change or review VmiYou Prisma models, PostgreSQL queries, indexes, transactions, locks, retention, or migrations safely.
---

# Database management

1. Read `backend/AGENTS.md`, `docs/specs/database.md`, and the domain spec owning the data.
2. Model ownership, lifecycle and delete behavior explicitly. Preserve uniqueness and provenance; add indexes for demonstrated query/lock paths.
3. Generate a forward-only named migration and inspect SQL. Never use production schema push.
4. Apply only to an explicit local/test database; integration databases must end `_test`.
5. Test transactions, concurrency, defaults and compatibility; update affected specs.
6. Production migration requires explicit authorization, backup and rollback plan.
