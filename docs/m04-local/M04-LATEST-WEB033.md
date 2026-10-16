# Brovexa M04 — WEB-032/033 Local Development Checkpoint

Date: 2026-10-16
Repository: Vertex-Systems-Network/brovexa
Branch: checkpoint/m04-local-web006-20261016
Module status: IN PROGRESS (NOT final complete)

## WEB-032: Canonical worker cancellation-store timeout

- `website-live-worker.ts`: each `isCancellationRequested()` call is now bounded by `awaitM04LiveStage()` using an independently validated timeout (`cancellationCheckTimeoutMs`, default 5000ms, minimum 100ms, maximum 30000ms).
- Initial hung cancellation-store query now fails retryably *before* tenant request lookup, preventing indefinite work-unit startup.
- Later hung polling also aborts in-flight stage waits and maps to the existing retryable cancellation-monitor-failed classification; externally requested cancellation stays cancelled.
- Three native Vitest regression candidates added to `website-live-worker.spec.ts`.

## WEB-033: Live retention work-unit handler

- Added `website-live-maintenance-worker.ts` and native Vitest spec file.
- Explicit opt-in; never auto-registers with canonical worker, starts a queue, creates DB pools, schedules maintenance, or contacts a website.
- Work type `website_inspection_live_retention_v2`, version `2`; canonical work-unit workspace scope only. Queue payload must be exactly `{kind:'website_live_retention_v2'}`. No arbitrary workspace, retention timestamp, SQL, or row IDs allowed from payload.
- Independently approved per-workspace maintenance role, bounded authorization/cancellation waits, and a 1..500 row budget (default 100).
- Reuses PostgreSQL 0019 `purgeExpiredWebsiteLiveInspectionEvidence()`, using `FOR UPDATE SKIP LOCKED`, row cap and workspace filter. DB transaction acknowledgement is awaited; no fake abort of an already-started commit.
- Stable work-unit effect hash, observed deleted count, fail-closed ack validation, known transient SQLSTATE retries, security denies permanent.
- Eight native Vitest regression candidates staged. Candidate tests NOT RUN.

## Verification and follow-on gates

- **No new tests, native Vitest, TypeScript, CI, migrations or queues run in this batch** in accordance with user's defer-until-module-complete instruction.
- Last previously verified isolated suite results do NOT apply to new WEB-032/033 code.
- Real PostgreSQL 18 migrations 0018/0019, Valkey queue registration/recovery, native Node 24+pnpm 11 integration, M02 live policy-store, final RBAC/security/rollback and deployment gates remain open.
- All changes must remain on development branch; do not merge `main`, modify PR #174, or activate production.