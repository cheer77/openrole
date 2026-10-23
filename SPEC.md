# VmiYou specification index

VmiYou is a vacancy discovery site backed by verified ATS/API feeds, with a private owner workspace. This index routes maintainers to the smallest relevant document; it is not a second copy of them.

- [Product](docs/specs/product.md) — scope, users, current and planned capabilities.
- [Frontend](docs/specs/frontend.md) — Next.js structure, rendering and data flow.
- [Backend](docs/specs/backend.md) — NestJS services, providers and worker boundaries.
- [Database](docs/specs/database.md) — Prisma ownership, relations and migration rules.
- [API](docs/specs/api.md) — public, internal and owner contracts.
- [Design system](docs/specs/design-system.md) — tokens, components, responsive/accessibility rules.
- [Job synchronization](docs/specs/job-synchronization.md) — scheduler, manual runs, tracking and recovery.
- [Admin panel](docs/specs/admin-panel.md) — authentication and owner workflows.
- [Security](docs/specs/security.md) — trust boundaries, secrets and privacy.
- [Deployment](docs/specs/deployment.md) — local/production topology, migrations and rollback.
- [Testing](docs/specs/testing.md) — unit, integration and E2E strategy.

Implemented behavior is stated as current. Future ideas must be labelled **Planned**. Update only the specs affected by a code or operational change.
