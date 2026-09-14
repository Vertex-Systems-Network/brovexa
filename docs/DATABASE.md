# Brovexa M01 Database Foundation

Status: **ABD-260 verified / Done**

Final executable evidence: GitHub Actions run `33333195961`, PostgreSQL integration job `99315636396`.

## Technology baseline

- PostgreSQL `18.6` for the M01 verification target
- `drizzle-orm 0.45.2`
- `drizzle-kit 0.31.10` as schema-generation/review tooling
- `pg 8.23.0` / `@types/pg 8.23.1`

The runtime is PostgreSQL-provider-neutral. No hosted database vendor is selected or activated by this work.

## Tenant root

`workspaces` is the canonical tenant root. M01 deliberately does **not** implement users, memberships, roles or permissions; those belong to ABD-262.

`workspace_preferences` is a one-to-one workspace-scoped child used to establish and test foreign-key/cascade conventions without pulling identity scope forward.

IDs are PostgreSQL UUIDs with `gen_random_uuid()` defaults. Workspace slugs are unique and constrained to lowercase alphanumeric/hyphen form.

## Local database

Start the pinned local database:

```bash
docker compose -f compose.dev.yml up -d postgres
```

Local-only connection string:

```text
postgresql://brovexa:brovexa-local-only@127.0.0.1:5432/brovexa_dev
```

Set it as `DATABASE_URL` in `.env` when database-backed readiness is required. The example credential is only for the local Compose service and must never be reused in production.

PostgreSQL 18 changed its official image data-volume layout; the Compose volume intentionally mounts `/var/lib/postgresql`.

## Migration contract

Reviewed migrations live in:

```text
packages/db/migrations/<id>.up.sql
packages/db/migrations/down/<id>.down.sql
```

The custom M01 migrator provides:

- deterministic lexicographic ordering
- SHA-256 checksum validation
- `brovexa_internal.schema_migrations` journal
- transaction-wrapped apply/rollback
- PostgreSQL advisory lock during schema mutation
- explicit reviewed down migration for rollback verification
- caller-visible apply/rollback results only after successful transaction commit

Drizzle Kit's `schema:generate` command writes generated review material to `packages/db/generated`. Generated SQL is not automatically production-approved; promote changes into the reviewed up/down migration contract after review.

## Integration verification safety

`pnpm run verify:db` is destructive to its target database and therefore refuses to run unless:

1. `BROVEXA_DB_TEST_ALLOW_RESET=true`; and
2. the connected database name ends with `_test`.

The GitHub integration job uses an ephemeral PostgreSQL 18.6 service database named `brovexa_m01_test`.

The verified test proves:

- migration apply
- PostgreSQL major version 18
- schema readiness probe
- unique workspace slug rejection using PostgreSQL SQLSTATE `23505` and exact constraint identity
- workspace-preferences foreign-key rejection using SQLSTATE `23503` and exact constraint identity
- cascade deletion
- transaction rollback
- explicit down migration
- table removal after rollback
- successful re-apply

## API readiness

`GET /health` remains process health and does not require a database.

`GET /ready` is database-aware and fails closed when:

- `DATABASE_URL` is absent
- the database cannot be reached
- PostgreSQL major version is not 18
- required M01 schema is missing

No raw database exception/connection string is returned by the readiness endpoint.

## Recovery

M01 rollback is tested only for the latest reviewed migration in a controlled test database. Production schema rollback policy remains **forward-fix preferred** once real customer data exists unless an incident-specific recovery plan proves a down migration is data-safe.

Never run destructive reset verification against a database that does not satisfy the explicit test guards.
