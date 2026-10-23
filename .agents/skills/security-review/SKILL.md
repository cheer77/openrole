---
name: security-review
description: Review or harden VmiYou authentication, authorization, admin APIs, secrets, validation, privacy, SSRF, and trust boundaries.
---

# Security review

1. Read `docs/specs/security.md` and affected API/deployment specs. Define attacker, trusted hop, sensitive data and mutation boundary.
2. Trace browser → BFF → Nest → database/queue. Verify exact allowlisting, Origin validation, OwnerGuard/internal-key checks and audit records.
3. Check Zod strictness, URL constraints, error sanitization, sessions, cookies, rate limits and logs. Never print live secrets.
4. Preserve analytics minimization and retention.
5. Add negative authorization/validation and concurrency tests where bypasses are possible.
6. Report evidence and severity; production security settings require explicit authorization.
