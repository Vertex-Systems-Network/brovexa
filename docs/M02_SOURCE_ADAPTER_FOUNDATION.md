# M02 — Provider-Neutral Source Adapter Foundation

Status: **IMPLEMENTED ON FEATURE BRANCH — AWAITING FULL GATE / INTEGRATION**

Updated: 2026-09-01

## Purpose

This is the first bounded implementation slice of **M02 — Business Discovery & Source Connectors**. It converts the planning-only source-policy matrix into executable provider-neutral contracts and deterministic admission/result validation without activating any production connector, provider credential, network call, scraper or external API.

The slice preserves the architecture rule:

`SourceRecord / TransientResult → normalized candidate → policy check → entity resolution → independent verification where required → Evidence / Fact / Signal`

A source/provider response cannot silently become canonical truth.

## Executable contracts

`packages/contracts/src/source.ts` defines:

- the exact six ConnectorPolicy states from `docs/SOURCE_POLICY_MATRIX.md`;
- the exact five source storage classes;
- explicit source classes, access methods and bounded operations;
- `SourceCapability` with fields, geography, pagination and hard-budget limits;
- `ConnectorPolicy` with purpose, field, classification, storage, canonicalization, attribution, export, personal-data, geography, robots, quotas, cost, credential, fallback and review metadata;
- `ConnectorDefinition` with explicit approval and activation state;
- bounded `SourceRequestEnvelope` and health snapshot contracts;
- deterministic connector admission decisions;
- provenance-bearing `SourceReference` plus unverified normalized `SourceCandidate` contracts;
- bounded `SourceResultEnvelope` and result/admission validation.

## Hardened public adapter boundary

`packages/contracts/src/source-adapter.ts` is the package-root public M02 boundary. It wraps the lower-level contract evaluator with additional fail-closed enforcement so callers cannot widen source rights through an apparently valid request/result.

It additionally proves/enforces:

- export requests may contain only fields explicitly allowed for export, not merely fields allowed for internal collection;
- attribution-required policies cannot run against capabilities unable to provide attribution;
- page size and cursor length stay inside the exact SourceCapability limits;
- review/blocked admission cannot expose export or raw-payload permission;
- result `fields` keys must exactly match declared `fieldNames`, preventing undeclared payload fields;
- required source attribution must be present in result provenance;
- result cursor length remains inside capability bounds;
- exported result fields remain inside export rights.

The package root exports `./source-adapter`, not the lower-level draft evaluator directly.

## Fail-closed policy behavior

The deterministic admission boundary blocks or requires review for, among other cases:

- `BLOCKED`, `EXPIRED` and overdue policy review;
- `REVIEW_REQUIRED` policy state;
- connector identity/version/policy mismatch;
- unapproved access or credential mode;
- disabled/dry-run execution mismatch;
- unsupported operation, purpose, field or data classification;
- `AUTH_SECRET` source requests/results;
- personal-data restrictions/review;
- geography blocks/capability mismatch;
- storage/export/raw-payload restrictions;
- robots denial/unknown state where applicable;
- capability/policy budget overflow;
- stale/unknown/degraded/rate-limited/circuit-open connector health;
- insufficient current quota.

Unknown or ambiguous authorization never becomes an AI assumption.

## Verification

Contract tests cover:

- schema invariants for capabilities, policies, definitions, requests and normalized results;
- transient-only storage/export restrictions;
- purpose/field/budget widening rejection;
- policy review/blocked/expiry states;
- dry-run execution rejection;
- robots, health, circuit and quota behavior;
- candidate provenance and `AUTH_SECRET` rejection;
- result field/storage/budget/raw-payload violations;
- export-field hardening;
- attribution capability/result hardening;
- capability-specific pagination hardening;
- undeclared result-field rejection.

No database migration is introduced by this slice. Verification therefore runs through the existing contracts build/typecheck/unit path plus the complete repository FULL GATE regressions.

## Explicit non-scope

This slice does **not** implement or activate:

- Google Places, Brave, GeoNames, registry, B2B, social, job-board or other production provider calls;
- HTTP fetching, DNS resolution, SSRF-safe egress or robots retrieval;
- credential storage or provider secrets;
- source-task PostgreSQL persistence;
- ResearchJob/Preflight runtime;
- canonical Business/Location/Contact persistence;
- entity resolution, evidence promotion or signal generation;
- production acquisition schedules or background source execution.

Those remain separate independently verified M02/M02A slices.

## Next safe slice after integration

Implement durable versioned `SourceCapability` / `ConnectorPolicy` / `ConnectorDefinition` registry persistence plus tenant-safe SourceTask/preflight admission snapshots. Keep all real provider network execution disabled until that registry/persistence boundary is independently FULL-GATE verified.
