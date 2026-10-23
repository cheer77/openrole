---
name: frontend-development
description: Build or change VmiYou Next.js pages, React components, browser state, routing, SEO, or frontend API integration while preserving the existing architecture.
---

# Frontend development

1. Read `AGENTS.md`, `SPEC.md`, and only `docs/specs/frontend.md` plus the domain spec affected by the task.
2. Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before framework-level changes.
3. Locate the existing route/component/helper and reuse its data flow. Prefer Server Components; isolate the smallest interactive Client Component.
4. Preserve URL-driven search state, BFF trust boundaries, semantic HTML, focus/keyboard behavior, SEO metadata and explicit loading/error/empty/saving states.
5. Reuse components/tokens. If visuals change, also invoke the design-system workflow and update its documentation.
6. Add focused unit/E2E coverage, then run frontend lint, typecheck, tests and build.

Read `docs/specs/api.md` for contract changes and `docs/specs/admin-panel.md` for owner UI.
