# Brovexa M04 — WEB-045 / WEB-046 Development Checkpoint

Date: 2026-10-16
Development branch: `checkpoint/m04-local-web006-20261016`
Parent checkpoint: `5c30e267a4edc689318ade95509dfb6017a583d8`

## WEB-045 — Durable live inspection acknowledgement and error redaction

- Map the DB deferred `website_live_registry_current_guard` denial to `M04_LIVE_SOURCE_REGISTRY_REVOKED` (`PermanentWorkError`). SQL error message and policy details are not used in the public work effect.
- Recognize existing grant source, owner, and grant-COMMIT authorization constraints as permanent denials, not retryable transport errors.
- Normalize the existing app-layer inactive/invalid/conflicting grant or persistence errors into an explicit redacted permanent error.
- The live work handler no longer polls cancellation **after** `inspectAndPersistM04LiveRoot` resolves successfully, because that indicates a committed evidence transaction. This avoids marking a durable write cancelled after COMMIT (which could force an expired-grant retry). Pre-commit cancellation still uses existing async boundaries, admission checks and abort signal.
- Added Vitest regression candidates for revoked/expired registry, other grant guards, persisted conflict and post-COMMIT cancellation.

## WEB-046 — Durable retention work acknowledgement

- The maintenance work handler stops checking for cancellation **after** the transactional deletion and work-unit receipt COMMIT. A later cancellation cannot undo a committed deletion.
- The existing idempotent `website_live_retention_work_receipts` replay remains the recovery mechanism for a crash or later delivery.
- Added two Vitest regression candidates to verify original and replayed work effects despite cancellation becoming true after the commit.

## Verification and deployment status

- Newly added candidate tests: **NOT RUN** (per project deferred native acceptance workflow).
- Native Node 24 / pnpm 11, Vitest, PostgreSQL 18 migrations 0018–0024 up/down and Valkey queue recovery: **NOT VERIFIED**.
- No schema changes and no new migration reservation for this batch.
- No active network calls, worker auto-registration, production deployment, review/merge or modification to PR #174.
- This is an implementation checkpoint, **not** final M04 acceptance.