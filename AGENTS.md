# VmiYou agent guide

VmiYou is a public vacancy search product with a private owner workspace. The repository root is the Next.js frontend; `backend/` is the NestJS API and BullMQ worker. PostgreSQL is authoritative for product and synchronization state; Redis is queue infrastructure.

## Work safely

- Read [SPEC.md](SPEC.md), then only the relevant file under `docs/specs/`.
- Preserve existing architecture, source-level BullMQ deduplication, PostgreSQL advisory locks, privacy controls, and owner authorization. Do not create parallel sync pipelines or UI kits.
- Never deploy, push, run production migrations/syncs, or change Railway/Vercel without explicit authorization. Never place secrets in code, docs, output, or fixtures.
- Use Prisma migrations for schema changes. Apply them only to an explicit local/test database during development; inspect SQL before deployment.
- Validate external input with Zod, keep admin routes behind OwnerGuard and the Next BFF allowlist, and audit owner mutations.
- Preserve user changes in a dirty tree. Use focused commits only when requested; do not rewrite history.

## Frontend conventions

- Read the applicable Next.js 16 guide in `node_modules/next/dist/docs/` before changing framework behavior. Prefer Server Components; add `"use client"` only for interaction/browser state.
- Routes live in `app/`; reusable UI in `components/`; domain UI/state in `features/`; server adapters and pure helpers in `lib/`.
- Fetch backend data through server-side adapters/BFF. Provide explicit loading, error, empty, saving, conflict, and retry states. Maintain keyboard access, semantic labels, focus behavior, SEO rules, and 280–1440px layouts.
- Reuse the VmiYou design system and CSS tokens. Any UI/style/component change must update both [styles/README.md](styles/README.md) and [docs/specs/design-system.md](docs/specs/design-system.md).

## Quality and maintenance

- Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; browser-impacting work also runs relevant Playwright projects.
- Backend: `npm --prefix backend run lint`, `typecheck`, `test`; schema/API/queue work also runs integration tests against a dedicated `*_test` database.
- The version is identical in both package files and lockfiles. Use SemVer; before 1.0, incompatible preliminary-contract changes are MINOR. Verify with `npm run check:version`.
- Update only affected specs: API changes → `api.md`; schema → `database.md`; worker/sync → `job-synchronization.md`; UI → frontend/design/admin; deployment or test procedures → their specs and corresponding project Skill.
- Project workflows are in `.agents/skills/`. Backend-specific constraints are in [backend/AGENTS.md](backend/AGENTS.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
