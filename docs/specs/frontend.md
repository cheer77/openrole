# Frontend

## Purpose
Define the current Next.js application structure and browser-facing contracts.

## Current implementation
Next.js 16 App Router with React 19 and strict TypeScript. The repository root is the frontend root. Server Components load catalog data; Client Components handle filters, dialogs, analytics and admin interaction.

## Architecture and data flow
Routes in `app/` call `lib/api.ts` or server helpers. Browser writes go to first-party route handlers; `/api/admin/[...path]` is an allowlisted owner BFF. URL parameters are the durable public search state.

## Main components
`components/search-bar.tsx`, `components/select.tsx`, `features/jobs/`, `components/admin/`, `features/admin/`, `proxy.ts`, `lib/admin/`.

## Constraints
Read matching Next 16 docs before framework changes. Prefer Server Components. Client state must preserve URL/history, show explicit loading/error/empty/saving states, and remain keyboard/screen-reader usable. Preserve canonical/noindex behavior and responsive layouts.

## Known limitations
Public requests use `cache: no-store`; ISR is not enabled. Admin live views use bounded visibility-aware polling or active-run-only polling.

## Related files
`AGENTS.md`, `docs/specs/api.md`, `docs/specs/design-system.md`, `styles/README.md`, `tests/e2e/`.
