# M02 — Durable Source Registry & Admission Persistence

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the second bounded implementation slice of **M02 — Business Discovery & Source Connectors**. It makes the provider-neutral source contracts from `docs/M02_SOURCE_ADAPTER_FOUNDATION.md` durable without activating any production provider, credential, network request, scraper or external API.

The slice establishes an immutable, versioned registry for source capability/policy/connector identity and a tenant-scoped immutable record of the exact source request admission decision used before execution.

The governing rule remains:

`Source request → exact versioned registry resolution → deterministic policy admission → immutable admission snapshot → provider execution in a later independently verified slice`

A connector implementation must not infer, widen or silently rewrite source rights at runtime.

## Migration 0007

`packages/db/migrations/0007_source_registry_foundation.up.sql` adds:

- `source_capabilities`
- `connector_policies`
- `connector_definitions`
- `source_admission_snapshots`

The migration also adds exact registry identity keys, tenant-scoped admission indexes, foreign-key bindings and append-only mutation rejection.

`packages/db/migrations/down/0007_source_registry_foundation.down.sql` removes the slice in strict dependency order.

## Durable source registry

`packages/db/src/source-registry-persistence.ts` provides:

- `persistSourceCapability`
- `persistConnectorPolicy`
- `persistConnectorDefinition`
- `resolveConnectorRegistryEntry`
- `persistSourceAdmissionSnapshot`
- `getSourceAdmissionSnapshot`

The persistence boundary is version/content immutable:

- same key/version + same content is idempotent;
- same key/version + changed content is an explicit conflict;
- connector definitions must bind to an existing exact SourceCapability version;
- connector definitions must bind to an existing exact ConnectorPolicy version;
- access method must be permitted by the capability and match the policy;
- registry rows are append-only at PostgreSQL level.

## Admission snapshot invariants

`source_admission_snapshots` records the exact tenant/request/registry admission state used for preflight.

The persistence boundary enforces:

- tenant-scoped readback by `(workspaceId, snapshotId)`;
- exact `requestId` and `sourceTaskId` identity;
- exact source, connector and connector-version identity;
- exact policy ID/version identity;
- exact request/admission operation agreement;
- exact request/admission storage-class agreement;
- exact admission decision/reason/warning projection;
- exact `evaluatedAt` agreement between envelope and persisted timestamp;
- `AUTH_SECRET` requests are rejected before persistence;
- same snapshot ID + same content is idempotent;
- same snapshot ID + changed content or tenant is an explicit conflict;
- snapshots are append-only at PostgreSQL level.

These rules prevent a caller from persisting a forged admission envelope that appears to reference the correct connector while widening operation, storage or decision semantics.

## Schema readiness

`packages/db/src/client.ts` now includes the source registry schema in the Drizzle database surface and requires all four 0007 tables for `probeDatabase().schemaReady === true`.

Therefore rolling back 0007 makes the canonical readiness probe fail closed until the migration is reapplied.

## Verification

`scripts/verify-source-registry.mjs` proves, on PostgreSQL 18:

- complete migration application including 0007;
- idempotent SourceCapability persistence;
- changed same-version SourceCapability conflict;
- idempotent ConnectorPolicy persistence;
- changed same-version ConnectorPolicy conflict;
- missing capability rejection;
- idempotent ConnectorDefinition persistence;
- changed same-version ConnectorDefinition conflict;
- exact registry resolution;
- append-only capability/policy protection;
- tenant-scoped admission snapshot persistence/readback;
- same-ID replay idempotency;
- cross-tenant same-ID conflict;
- `AUTH_SECRET` rejection;
- connector identity mismatch rejection;
- operation mismatch rejection;
- storage-class mismatch rejection;
- evaluated-time mismatch rejection;
- append-only admission snapshot protection;
- direct invalid registry FK insertion rejection.

The verifier is chained through the canonical root `verify:db` path; the guarded root command remains unchanged:

`pnpm --filter @brovexa/db build && node scripts/verify-db.mjs`

The canonical DB harness also proves 0007 apply → rollback → reapply and full reverse migration teardown/rebuild.

All destructive M01A database/RBAC/queue verification harnesses were mechanically reconciled to reset the new source tables and expect migration 0007. Their original runtime assertions were not broadened or weakened.

## Explicit non-scope

This slice does **not** implement or activate:

- real provider HTTP/API calls;
- DNS resolution or SSRF-safe egress;
- robots retrieval;
- provider credentials or secret storage;
- source-task execution state machines;
- ResearchJob/Preflight worker execution;
- canonical Business/Location/Contact persistence;
- entity resolution or evidence promotion;
- Google Places, Brave, GeoNames, registries, social, jobs, licensed B2B or other production connectors;
- production scheduling/background acquisition.

No real external source can be called merely because a registry definition exists. `dry_run` remains non-production execution intent and this slice contains no provider transport implementation.

## Branch verification status

Feature branch base: `6dbd8c3491f5beec699a90e953bb4d2f789e65b8`

The implementation must not be marked verified or integrated until the exact final branch head passes the repository FULL GATE and the PR is merged with that exact expected head SHA.

### Exact integration evidence

To be filled only after successful hosted FULL GATE and merge:

- final source head: pending
- PR: pending
- exact-head FULL GATE run: pending
- quality/security job: pending
- PostgreSQL 18 migration + RBAC job: pending
- canonical worker + Valkey job: pending
- merge SHA: pending

## Next safe slice

After this registry/persistence boundary is independently FULL-GATE verified, implement the bounded durable `SourceTask` / ResearchJob preflight lifecycle that consumes an exact immutable admission snapshot. Keep provider transport execution disabled until task state, retry/idempotency, budget, cancellation and provenance boundaries are separately verified.
