---
name: design-system
description: Create or change VmiYou UI, styling, responsive behavior, accessibility, or reusable visual components using the existing design system.
---

# Design system

1. Read `docs/specs/design-system.md` and `styles/README.md`; inspect the nearest existing component and CSS.
2. Reuse variables, typography, spacing, buttons, fields, panels, tables, statuses and breakpoints. Do not add a second UI kit.
3. Implement semantic controls, labels, focus-visible treatment, keyboard behavior, contrast and reduced-motion compatibility.
4. Verify relevant states and 280, 320, 390, 768 and 1440px layouts.
5. Update both design documents to describe current behavior, not a changelog.
6. Run lint/typecheck and focused Playwright tests.
