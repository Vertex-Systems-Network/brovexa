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
6. Build an exact candidate combined tree and rerun protected native Node24/pnpm11 quality, PostgreSQL18 0000–0025 UP/DOWN/reapply and tenant/RBAC, Valkey, and M04 full-schema security. Validate current main and all required PR/resulting-main gates **before** a release/completion claim.

## Existing automated guard

`scripts/verify-m04-migration-contract.test.mjs` guards canonical budget fields, v2 live table separation and unique migration 0018–0025 reservations. It passes on the verified checkpoint, but cannot independently prove PR #174 merged-tree compatibility.

**Remaining QA-09 result:** source divergence independently confirmed; integration/migration-history reconciliation still OPEN. No main merge or production deployment performed.

## WEB-059 reservation impact — isolated checkpoint, not integrated
- `0025_website_live_current_domain_decision_guard` is reserved/implemented **only** on `checkpoint/m04-local-web006-20261016` as M04-WEB-059, with a reversible DOWN and [4/4 native CI proof](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39026164817) (source SHA `1e58fc0f095cf04892d7b87a4e69dac847e837c6`; PG18 security 30/30).
- This does not transfer migration-number ownership away from the occupied DATABASE slot or close 0018 divergence. Before integrated migration planning, the Supervisor/DB owner must reconcile all reservations and applied history; **do not allocate another 0025**, independently replay older PR 0018 or bypass the standing slot lease.
- A potential historic 0018 remediation should use the next genuinely reserved forward migration (currently `0026+` on the isolated checkpoint; final assignment is owned by the serialized integration path), not overwrite WEB-059's isolated 0025 or edit any applied checksum.
- QA-09 remains **OPEN** until one exact reconciled integration-tree migration history is reviewed and fully verified.
