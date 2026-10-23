---
name: deployment-review
description: Prepare or audit a VmiYou release for Railway/Vercel, migrations, environment compatibility, rollout, verification, and rollback without deploying automatically.
---

# Deployment review

1. Read `docs/specs/deployment.md`, `database.md`, `testing.md` and the changed domain spec.
2. Verify all four versions match. Review migration order, cross-service compatibility and required environment names without exposing values.
3. Run full quality gates and standard builders; separate code failures from tooling limits with evidence.
4. Produce an ordered backup, migrate, deploy, health-check, scheduler/run verification and rollback checklist.
5. Never push, deploy, migrate production, change Railway/Vercel or trigger production sync without explicit authorization.
6. Declare READY only when required checks are green and residual risks are acceptable.
