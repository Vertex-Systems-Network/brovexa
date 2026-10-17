# M04 QA-09 — migration 0018 / PR #174 reconciliation record

**Status: OPEN — blocked on integration-tree and migration-history verification.**
Read-only source inspection updated 2026-10-17. No merge, no PR #174 mutation, no production DB access.

## Exact branches and immutable file evidence

- Current integration base checked: `main` `250627046da8d8e201a1628b3e21047c7b5e2ab2`.
- Separate database draft PR [#174](https://github.com/Vertex-Systems-Network/brovexa/pull/174) head: `3728223f87dde287779fc456530b7b6be424dbe1` (`agent/database-persistence`, OPEN/DRAFT).
- Checkpoint: `checkpoint/m04-local-web006-20261016`; latest verified M04 WEB-059 code `1e58fc0f095cf04892d7b87a4e69dac847e837c6`.
- PR #174 migration `0018_website_inspection_evidence.up.sql` blob SHA: `41696665e6422b3a161476fbb3f5b1f5f17ec149`.
- Checkpoint migration `0018_website_inspection_evidence.up.sql` blob SHA: `6594231842cee29973711510fe968dd641baa2f7`.
- Migration 0018 DOWN is identical on both branches: blob SHA `72e83f57f556a58cb02c3918ea953f8b3476bd89`.
- Persistence source also diverges: PR adapter blob `d9e6e560f85a8361a643246312a862288e72d590`; checkpoint adapter blob `5c392c50f30099e78b8a0fa1602778c0c71d579c`.

## Material difference and consequence

The checkpoint 0018 UP schema makes `max_pages smallint`, `max_response_bytes integer`, and `timeout_ms integer` mandatory and enforces `website_runs_budget_check` with page 1–5, byte 1–1,000,000, and timeout 100–30,000 limits. Checkpoint persistence supplies all three values and uses 24 bind positions. The PR #174 0018 UP lacks these columns/constraint and its adapter inserts only 21 fields.

The same 0018 migration number cannot represent two SQL bodies for one deployed migration ledger. Cherry-picking or combining the draft into the checkpoint without resolving both SQL and the TypeScript persistence insert would break checksum reproducibility or the runtime schema contract. The matching DOWN SQL is **not** evidence that the two UP migrations are interchangeable.

## Dependency-safe integration decision

1. Preserve PR #174 and its DATABASE slot/lease; no direct branch takeover. Synchronize only through the authorized integration owner.
2. Check **actual applied migration ledger** of each targeted integration/staging database before selecting a history; no live database ledger was inspected in this checkpoint.
3. If neither divergent 0018 has been applied and a clean history is verified, adopt one budgeted, versioned 0018 implementation with a matching persistence adapter and its native regression tests. Do not silently use the unbounded draft.
4. If the older 0018 already exists in a database migration ledger, **retain its applied checksum** and design an approved forward-only `0026+` repair (isolated M04 WEB-059 already reserves `0025`) with explicit compatibility/backfill semantics; do not edit an applied migration.
5. Reconcile the shared `.agent/migrations.yaml` ledger (`next_unreserved_number: "0019"` in PR draft versus `"0026"` on checkpoint), under serialized migration ownership.
6. Build an exact candidate combined tree and rerun protected native Node24/pnpm11 quality, PostgreSQL18 0000–0026 UP/DOWN/reapply and tenant/RBAC, Valkey, and M04 full-schema security. Validate current main and all required PR/resulting-main gates **before** a release/completion claim.

## Existing automated guard

`scripts/verify-m04-migration-contract.test.mjs` guards canonical budget fields, v2 live table separation and unique migration 0018–0026 reservations. It passes on the verified checkpoint, but cannot independently prove PR #174 merged-tree compatibility.

**Remaining QA-09 result:** source divergence independently confirmed; integration/migration-history reconciliation still OPEN. No main merge or production deployment performed.

## WEB-059 reservation impact — isolated checkpoint, not integrated
- `0025_website_live_current_domain_decision_guard` is reserved/implemented **only** on `checkpoint/m04-local-web006-20261016` as M04-WEB-059, with a reversible DOWN and [4/4 native CI proof](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39026164817) (source SHA `1e58fc0f095cf04892d7b87a4e69dac847e837c6`; PG18 security 30/30).
- This does not transfer migration-number ownership away from the occupied DATABASE slot or close 0018 divergence. Before integrated migration planning, the Supervisor/DB owner must reconcile all reservations and applied history; **do not allocate another 0025**, independently replay older PR 0018 or bypass the standing slot lease.
- A potential historic 0018 remediation should use the next genuinely reserved forward migration (currently `0027+` on the isolated checkpoint; final assignment is owned by the serialized integration path), not overwrite WEB-059's isolated 0025 or edit any applied checksum.
- QA-09 remains **OPEN** until one exact reconciled integration-tree migration history is reviewed and fully verified.

## WEB-060 reservation impact — connector revision fence, isolated checkpoint
- The checkpoint now also reserves and implements `0026_website_live_current_connector_revision_guard`, with reversible DOWN and [4/4 native CI #39039079620](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39039079620), exact tested code `6821161f5294d7855d4c01adedc8a2f997adfc27`; real PG18 security **35/35 PASS**.
- The checkpoint ledger currently has `next_unreserved_number: "0027"`, with isolated `0025` (domain) and `0026` (connector) `IMPLEMENTED`. The occupied DATABASE slot's draft PR #174 still carries a divergent `0018` and its own older reservation view; **do not merge or assign migration 0025/0026 elsewhere without serialized reconciliation**.
- If historical `0018` was already applied with the different SQL body, preserve the exact applied checksum and use the next approved forward migration, after reconciling all existing reserved slots, to repair missing fixture budget enforcement. Never edit already-applied 0018.
- Protected candidate merged-tree tests must cover 0000–0026 UP/DOWN/reapply, PG18 grants/evidence/domain+connector authorization and tenant RBAC, Node quality and Valkey at one exact tree SHA.
- QA-09 remains OPEN; this only advances an isolated development checkpoint and does not certify any production/staging database history.

## WEB-061 — executable read-only migration 0018 provenance gate (2026-10-17)

- Exact code SHA: `c0d0d86121083464110882266684c02a83c7e55f`. [Native checkpoint run #39044533719](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39044533719) **SUCCESS 4/4**: pinned Node24/pnpm11 quality/typecheck/Vitest, PostgreSQL18 full migrations/tenant/RBAC, Valkey, and M04 full-schema authorization. PG18 security remains **35/35 PASS**.
- Added `scripts/m04-0018-provenance.mjs`, `scripts/verify-m04-0018-history.mjs`, and `scripts/verify-m04-0018-history.test.mjs`; wired 16 pure classification regressions to quality CI and a real read-only PostgreSQL journal/schema check to the full-schema security CI.
- The real **disposable CI** `brovexa_m04_qa_live_test` database reports `CANONICAL_APPLIED`, applied and local 0018 SHA256 both `7d2779e5dc2ad78de358ca013edf15af20165715ff326fb5c5cbefa4dfc82e67`. All required budget/retention columns have expected SQL types, are NOT NULL, and required CHECK constraints are validated and include the relevant fields. This evidence pertains **only** to that disposable test database.
- Pure tests require fail-closed classifications for a matching applied version, clean unapplied history, known divergent peer version, unknown checksum, invalid journal checksum, unjournaled tables, schema drift (missing columns/constraints, wrong types, nullability, invalid/weak CHECK), and out-of-order 0019 / future 0030 migrations without 0018. A defective initial gap-detection regex was caught by CI and corrected before the successful run.
- The script executes inside an explicit `REPEATABLE READ READ ONLY` transaction. It never modifies migration journal rows, schema, fixtures, approvals, or production data; no other host than guarded loopback `brovexa_m04_qa_*_test` is permitted. It does not log connection credentials.
- Optional `BROVEXA_M04_ALTERNATE_0018_UP_FILE` lets an authorized local operator supply the exact unmodified draft migration file for peer fingerprint classification; a matching alternate journal hash returns `KNOWN_DIVERGENT_APPLIED` and **fails**. The script never fetches peers or rewrites history.
- **QA-09 OPEN:** This does not inspect PR #174's applied environment nor any authorized staging/production migration journal, and does not reconcile the incompatible PR's 0018 SQL/adapter with the checkpoint's SQL/adapter. The next integration owner must choose one checksum-compatible migration lineage for the exact candidate combined tree and, if necessary, a separately reserved forward-only fix. Draft PR #174, occupied DATABASE lease, main and production are untouched.
