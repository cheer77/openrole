# Admin panel

## Purpose
Describe the private owner workspace and its operational boundaries.

## Current implementation
Owner login/session, dashboard analytics, jobs, companies, sources, discovery, import logs, integrations, audit log and System. System shows service/queue health, release, dynamic scheduler settings, manual global run, active progress, statistics and recent history.

## Architecture and data flow
Admin App Router pages render client control components. `useAdminData` calls the allowlisted BFF; Nest OwnerGuard revalidates the token. Mutations show saving/success/conflict/error states. Sync polling runs every five seconds only while a global run is active.

## Main components
`app/admin/`, `components/admin/`, `features/admin/`, `lib/admin/`, `backend/src/admin.ts`, `control-center.ts`.

## Constraints
All pages are noindex. Never expose internal keys to the browser. Disable duplicate submissions, surface 409 distinctly, audit mutations and preserve UTC clarity for operational timestamps.

## Known limitations
Single owner role; no granular RBAC. Run detail API exists while the initial history table presents summary rows.

## Related files
`docs/specs/api.md`, `security.md`, `design-system.md`, `job-synchronization.md`.
