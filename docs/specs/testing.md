# Testing

## Purpose
Define evidence required before release.

## Current implementation
Node unit tests cover frontend helpers and backend domains. Backend integration tests use an explicit `*_test` PostgreSQL database and real Nest app. Playwright runs production frontend/API fixtures across Chromium, Firefox and WebKit plus owner projects.

## Architecture and data flow
Unit tests avoid infrastructure. Integration tests apply migrations and isolate fixtures. E2E startup in `tests/support/start-api.mjs` prepares test data and Redis DB 15, then Playwright drives `http://127.0.0.1:3100` with matching `APP_ORIGIN`.

## Main components
`tests/*.test.ts`, `backend/tests/*.test.ts`, `backend/tests/integration/`, `tests/e2e/`, `playwright.config.ts`.

## Constraints
Never point tests at production or a database without `_test`. Do not mask failures with skips. Avoid parallel tests that mutate the same fixtures; owner projects run after public regressions. Verify lint, both typechecks, unit/integration tests, standard Turbopack frontend build and backend build.

## Known limitations
Playwright browsers must be installed locally. Turbopack requires filesystem/IPC permissions unavailable in some sandboxes; verify outside that sandbox rather than changing the default builder.

## Related files
`.agents/skills/testing-quality/SKILL.md`, `README.md`, `backend/README.md`.
