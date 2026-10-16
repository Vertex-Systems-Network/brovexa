# M04 Non-live consolidated checkpoint — 2026-10-16

Repository: Vertex-Systems-Network/brovexa
Branch: checkpoint/m04-local-web006-20261016
Mainline: untouched
DATABASE PR #174: untouched
Live transport/provider activation: excluded

## Code delivered
- Copied WEB-002 migration 0018 and persistence source from existing draft DB branch into independent M04 checkpoint; enhanced domain/policy validation, review reason consistency, tenant retention/deletion, and request page/bytes/timeout budget persistence.
- Completed non-live `createM04NonLiveDatabaseIntegration` for Zod contracts, fixture work handler, PostgreSQL persistence callback, and workspace-authorized evidence deletion. No worker auto-registration, HTTP/DNS, queue activation or production source calls.
- Kept previously developed WEB-003..025 fixture pipeline, cancellation and worker adapters.
- Added native Vitest test candidates for isolated composition and persistence, plus updated offline regression expectations.

## Local verification actually performed
- `tsc --noEmit -p working/tsconfig.json`: PASS. Local typing shim / six-file scope, not full native workspace.
- Node v22 isolated fixture suite (7 .test.mjs files): **255 PASS, 0 FAIL**.
- Native Node >=24.20, pnpm 11.23, Vitest 4.1, PostgreSQL 18 migration up/down and Valkey worker queue: NOT RUN (tools/dependencies absent; clone denied by DNS).
- Independent security review, PR exact-head full gate, mainline merged tests: NOT RUN.

## Remaining non-live acceptance blockers
1. Run true native workspace `pnpm run typecheck`, `pnpm run test`, `pnpm run verify:db` and quality gate on a fully provisioned runner.
2. PostgreSQL 18 migration up/down and tenant/FK/trigger/concurrency/retention validation, including PostgreSQL transaction rollback when cancelled.
3. Valkey queue handling for work deliveries, retries, cancellation and reconciliation.
4. Reconcile modified migration 0018 with the standing DATABASE PR #174; migration checksum must never be changed after installation.
5. Independent security acceptance / exact-head and resulting-main full gate.

This checkpoint is **not production-ready** and should not be merged until gates pass. All live network functionality remains excluded.