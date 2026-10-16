# M04 native QA-04 closure and live authorization acceptance

## Exact source and native evidence

- Source checkpoint: `52b84bf1a25adf0e71225cf67791bd0198e6ac00`.
- GitHub Actions: https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38950411919; all 3 jobs succeeded: `native-quality`, `native-postgres`, `native-valkey`.
- Full native quality: 7/7 workspace builds, 11/11 workspace typechecks, native Vitest through all workspace test tasks; worker suite 249/249.
- PostgreSQL 18 `scripts/verify-db.mjs` discovers all committed migrations, applies them, reverses **every** migration in descending ID order using `rollbackLatestMigration`, checks core tables are absent, reapplies **every** migration and verifies readiness. This ran green on a disposable Postgres 18 container. QA-04 is **CLOSED for this checkpoint's full-chain fresh-database rollback/reapply**; no claim is made about executing rollback against an existing production database.
- Native identity/RBAC and Valkey retry/recovery integration also green on isolated CI service containers. No production data, endpoints, credentials, deploy or live network fetch used.

## Dedicated M04 live security gate (new work)

`scripts/verify-m04-live-security.mjs` uses only a strictly guarded localhost `*_test` database. It ensures migrations are present, seeds owner, verified-domain, domain evidence, M02 connector/source/allow snapshot into the **full native schema**, and checks: (1) valid active-owner grant, (2) non-owner rejection, (3) cross-tenant verified-domain rejection, (4) cross-tenant M02 source rejection, (5) grant expiry bound, (6) blocked connector policy despite historical `allow`, (7) immutable grant UPDATE rejection. Every fixture is inside an outer `ROLLBACK`, every expected rejection inside a savepoint. No source is fetched. This gate must run green in CI before closing the M04-specific authorization acceptance.

## Migration 0018 / separate PR #174 reconciliation (still open)

- PR #174: `agent/database-persistence`, open/unmerged at `3728223f87dde287779fc456530b7b6be424dbe1`; unrelated to this M04 checkpoint branch, **not modified**.
- `packages/db/migrations/0018_website_inspection_evidence.up.sql` in PR #174 is **NOT byte-identical** to the checkpoint file. The checkpoint version includes persisted request safety budget columns `max_pages`, `max_response_bytes`, and `timeout_ms`, as required by the native WEB-001 contract/handoff. PR #174 does not include those columns at the first divergent table definition. The checkpoint migration also contains a required PostgreSQL PL/pgSQL dollar-quote fix.
- `packages/db/migrations/down/0018_website_inspection_evidence.down.sql` is identical between the two branches.
- `packages/db/src/website-inspection-persistence.ts` differs as well; checkpoint implementation persists safety budgets while PR #174 draft does not.
- These version differences imply **different migration 0018 SHA256 checksums**. Do not merge the draft and checkpoint histories blindly: doing so could lead to a migration journal checksum mismatch or runtime column errors.
- Integration gate: reconcile PR #174 to the checkpoint migration and persistence contract using one explicitly reviewed source of truth, then verify `0018` checksum and migration history on the exact proposed merge head, using a disposable PostgreSQL 18 environment. **Do not rewrite existing production migration journals.**

## Known boundaries

Native full rollback was tested on a disposable QA database, not production. The new dedicated M04 live security gate is not green until its own native run passes. Live-target network acquisition remains gated. PR #174 merge reconciliation and production activation are deliberately excluded from this checkpoint.