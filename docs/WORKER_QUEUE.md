# Brovexa M01 Durable Worker & Queue Foundation

Status: **ABD-261 in implementation**

## Canonical truth boundary

PostgreSQL is the source of truth for job runs, work units, attempts, checkpoints, cancellation, error classification and canonical effect receipts.

BullMQ + Valkey is execution transport only. Queue delivery, retry counters or queue retention must never be treated as proof that a business effect occurred.

## Runtime candidates and current M01 pin

M01 initially pins BullMQ `5.81.4` rather than adopting the newly released v6 major by default. This is a conservative foundation choice and can be changed later through evidence/ADR.

Valkey is pinned for local/CI compatibility verification to:

```text
ghcr.io/valkey-io/valkey:9.1.1-alpine3.24@sha256:de31910896150d5e754a07d57d227cfdde4e258ddd0d1aa4607f2d2f95843715
```

BullMQ does not currently document Valkey as an explicitly tested compatible alternative, so compatibility is treated as an executable test result, not an assumption.

## Queue convention

- namespace/prefix: `brovexa`
- work queue: `brovexa-work-v1`
- delivery name: `execute-work-unit`
- delivery job id: `wu-<workUnitId>-a<attempt>`
- BullMQ automatic attempts: `1`

Canonical retry/backoff is controlled by PostgreSQL work-unit state. A retry creates a new attempt-scoped transport delivery.

## Canonical tables

Migration `0001_job_execution_foundation` adds:

- `job_runs`
- `job_work_units`
- `job_checkpoints`
- `job_effects`

`job_effects(work_unit_id, effect_key)` is unique and is the M01 canonical effect guard.

## Recovery

A running work unit carries a bounded lease. Runnable work, due retry work and expired running leases are discovered from PostgreSQL and re-enqueued idempotently. This means Valkey can be empty after restart and Brovexa can reconstruct execution transport from canonical state.

## Error model

- `retryable` → `retry_wait` until `max_attempts`, then `dead_letter`
- `permanent` → `review`
- `cancelled` → `cancelled`

Unhandled errors are fail-closed as permanent/review rather than retried indefinitely.

## Local development

Start PostgreSQL and ephemeral Valkey transport:

```bash
docker compose -f compose.dev.yml up -d postgres valkey
```

Worker environment:

```text
DATABASE_URL=postgresql://brovexa:brovexa-local-only@127.0.0.1:5432/brovexa_dev
QUEUE_REDIS_URL=redis://127.0.0.1:6379
WORKER_PORT=3002
```

Build and start:

```bash
pnpm --filter @brovexa/worker build
pnpm --filter @brovexa/worker start
```

The local Valkey container intentionally disables AOF/RDB persistence. Losing transport state is expected; canonical recovery comes from PostgreSQL.

## Verification

`pnpm run verify:queue` is destructive and must only target an explicitly authorized `*_test` PostgreSQL database with `BROVEXA_DB_TEST_ALLOW_RESET=true`.

The integration gate must prove:

- BullMQ ↔ pinned Valkey compatibility
- canonical job/work-unit idempotency
- retry produces one canonical effect
- stale delivery cannot duplicate canonical effect
- recovery from PostgreSQL after a simulated crashed lease
- pre-run cancellation
- permanent failure → review
- retry exhaustion → dead letter
- worker DB/queue readiness

No hosted queue provider, production queue secret or production worker deployment is activated in M01.
