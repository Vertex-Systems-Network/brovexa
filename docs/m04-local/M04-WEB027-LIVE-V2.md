# Brovexa M04 — WEB-027 / live v2 development checkpoint

Date: 2026-10-16. Owner scope: **all remaining tasks including live**.

## Candidate source added
- `packages/db/src/website-live-persistence.ts`: strict v2-only evidence snapshot, never invoke source field getters, atomic parent/observation write, deterministic same-ID replay; explicit tenant-scoped deletion and bounded expiry cleanup.
- `packages/db/migrations/0019_website_live_inspection_evidence.up.sql` and `down/...`: separate v2 PG schema, tenant and verified-domain foreign keys, exact HTTPS root, public IPv4 receipt, v2-only live/no-body provenance, immutable evidence, observation receipt binding and retention checks.
- `apps/worker/src/website-live-native-integration.ts`: trusted storage-policy read, v2 persistence wiring, separate deletion RBAC guard.
- `apps/worker/src/website-live-worker.ts`: opt-in canonical work-type registration with restricted payload and per-work-unit cancellation; **not activated in main worker entry point**.
- Native Vitest candidate tests for DB and worker, plus local isolated DB mock tests.
- Fix pre-existing migration 0018 dollar-quote terminator in the M04 checkpoint branch only (the separate DATABASE PR #174 remains untouched).

## Verification
- Isolated TypeScript v2 DB: PASS with a **local-only stub `client.ts`**, NOT native PG package compilation.
- Isolated TypeScript live v2 integration: PASS with ambient declarations, NOT full workspace.
- 10/10 isolated live DB mock tests: PASS; **not PostgreSQL server execution**.
- No actual external URL contacted, no live worker registered or deployed.
- PostgreSQL 18 migration up/down/concurrency, native Node24/pnpm/Vitest, Valkey and full CI gates: NOT RUN; module not final.

## Mandatory remaining before marking complete
- Run real PostgreSQL 18 migration 0018 and 0019 up/down plus cross-workspace, receipt, replay/concurrency, retention tests.
- Run full native workspace build/test on Node 24.20+ and pnpm 11.23+, fix any native contract differences.
- Verify integrated M02 signed per-hop policy admission and actual trusted tenant-scoped permit/policy storage; no invented operator approval.
- Run worker queue cancellation/retry/reconciliation under Valkey, independent security review and exact-head CI.
- Reconcile original DATABASE PR #174 before main merge. No production activation until authorized configuration and QA.