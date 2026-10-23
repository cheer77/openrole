---
name: testing-quality
description: Plan and run VmiYou unit, integration, Playwright, lint, typecheck, build, and pre-release quality verification without masking failures.
---

# Testing and quality

1. Read `docs/specs/testing.md` and choose the smallest meaningful test layer, then finish with risk-appropriate release gates.
2. Use unit tests for pure contracts, backend integration for PostgreSQL/Nest, and Playwright for browser workflows.
3. Confirm `TEST_DATABASE_URL` points to a dedicated `_test` database. Never run fixtures or cleanup against production.
4. Diagnose failures before changing assertions. Do not weaken behavior or add skips to get green.
5. Run frontend/backend lint and typecheck, unit/integration tests, standard Turbopack build, backend build and relevant/full E2E.
6. Report exact outcomes, environment limits and residual risk.
