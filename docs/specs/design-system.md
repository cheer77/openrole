# Design system

## Purpose
Keep VmiYou visually coherent, accessible and responsive without a second UI kit.

## Current implementation
CSS tokens and foundations live under `styles/`; reusable React primitives include buttons, fields, `Select`, dialogs, cards, tables, statuses and admin panels. Admin → System composes these primitives for scheduler settings, manual run progress, statistics and history.

## Architecture and data flow
`app/layout.tsx` controls stylesheet order. Page CSS consumes shared variables/component classes. Components expose semantic labels and state; CSS owns presentation and breakpoints.

## Main components
`styles/variables.css`, `base.css`, `components/`, `pages/`, `styles/README.md`, `components/select.tsx`, `components/admin/`.

## Constraints
Reuse tokens/components, visible focus, sufficient contrast, semantic controls, reduced-motion behavior and layouts from 280–1440px. UI changes update this spec and `styles/README.md` in the same task.

## Known limitations
The system is repository-local rather than a published component package.

## Related files
`docs/specs/frontend.md`, `admin-panel.md`, `.agents/skills/design-system/SKILL.md`.
