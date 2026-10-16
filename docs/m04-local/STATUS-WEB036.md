# Brovexa M04 — WEB-036 development checkpoint

2026-10-16 · Development branch: `checkpoint/m04-local-web006-20261016`

WEB-036: new forward migration 0021 adds a deferred PostgreSQL constraint trigger for live v2 evidence. Migration 0020's FK alone only verifies the grant existed, not that it remains unexpired or owner authorization stays active at evidence commit. The trigger performs a database-backed current-owner, domain-verification, source-admission and grant-bound-budget check, with row locks to prevent simultaneous policy/owner revocation races. Existing migrations 0018–0020 are not rewritten.

Worker now classifies that specific grant constraint violation as a permanent, redacted `M04_LIVE_GRANT_NOT_ACTIVE_AT_COMMIT` work failure; unrelated constraints are not mislabeled. Native Vitest candidates cover permanent classification and migration structure. **Tests, TypeScript, CI, PostgreSQL 18 up/down and Valkey worker recovery NOT RUN for WEB-036** pending final M04 module gate per owner instruction.

Production live worker remains opt-in, without deployment or environment activation. Draft DATABASE PR #174 and `main` remain unchanged. Full PostgreSQL migration/rollback acceptance and independent security review remain open.