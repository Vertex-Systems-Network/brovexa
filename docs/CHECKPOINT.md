# Brovexa Project Checkpoint

Updated: 2026-10-16

## Project state

`ACTIVE_EXISTING_PROJECT`

- **M01 Platform Foundation:** VERIFIED / INTEGRATED.
- **M01A provider-neutral AI Agent Runtime & Memory OS:** VERIFIED / INTEGRATED; production models/providers separately gated.
- **M02 Business Discovery & Source Connectors:** provider-neutral foundation integrated; external transport separately gated.
- **M02A Global Acquisition Studio:** planned provider-neutral packets ACQ-001–006 VERIFIED / INTEGRATED.
- **M03 Entity Resolution & Contact Enrichment:** **FINAL COMPLETE / INTEGRATED (bounded provider-neutral scope).** ER-001 through ER-006 and DB migrations 0014–0017 integrated. PR #166 and PR #170 both passed exact-head FULL GATE 3/3; resulting-main FULL GATE `38806104170` and `38808590274` passed 3/3. Original three ER-006 adversarial test blobs preserved. Owner-recovered VERIFY #167 and CONTRACTS #168 CLOSED. Original VERIFY 50-commit and CONTRACTS 29-commit histories preserved. Production traffic, credentials, outreach, deployment remain separately gated.

Last verified product main before documentation reconciliation: `dfa53dc93c9e8c4939be20e94962c9996b0a7cc0`, sync epoch 89; see issue #50 for latest main/epoch and issue #53 for live registry. This checkpoint is versioned historical evidence, not live atomic lease ownership. Supervisor's unrelated lane-local drift must not reopen a completed M03 product packet.

## Live-state authority

Do not infer current branch/agent state from this versioned file. Resolve live state from:

- GitHub issue **#50** — canonical integrated-main SHA and synchronization epoch;
- GitHub issue **#53** — logical slot occupancy, assignment baseline and registry revision;
- branch `coordination/leases` — exact live mutating-instance authority;
- GitHub issue **#54** — completed native `main` branch-protection/ruleset hardening record.

## Agent Instruction Drift Check

Every agent re-reads the relevant subset before work and again before completion:

- `AGENTS.md`;
- `README.md`;
- `docs/PROJECT_PLAN.md`;
- this checkpoint;
- `docs/AI_NATIVE_PLAN.md`;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md`;
- `docs/NEW_AGENT_ONBOARDING.md`;
- `docs/AGENT_BRANCH_LEASES.md`;
- `.agent/slots.yaml`;
- `.agent/ownership.yaml` / `.agent/shared-files.yaml`;
- `.agent/workstreams.yaml` / `.agent/dependencies.yaml`;
- `.agent/migrations.yaml` where persistence changes are possible;
- `docs/RUNNER_BENCHMARK.md` / `.agent/runner-benchmark.yaml` for deferred special-Runner obligations;
- issue #50, issue #53 and the live slot lease;
- the exact current branch/head and required verification commands.

A task cannot become ready for integration while future-agent instructions are materially stale.

## Coordination invariants

Hard invariant:

**one occupied slot = at most one live mutating agent instance**

Normal work:

`1 agent = 1 bounded packet = 1 standing/isolated branch = 1 PR`

New feature mutation requires the serialized sequence:

1. start from exact current `main` and issue #50 epoch;
2. Supervisor re-reads issue #53;
3. synchronize an assignable `OPEN` standing branch non-destructively;
4. Supervisor reserves it in issue #53 and increments registry revision;
5. re-read the reservation;
6. unique runtime instance atomically acquires/re-reads `.leases/<SLOT>.json`;
7. only then mutate within the packet's narrowed write scope.

If no assignable slot is open, the exact response remains:

**Go Home Come Back Next Time**

## Integration protocol

Non-Supervisor completion signal:

**Work Done and Submitted**

It must be a fresh top-level PR comment bound to the current exact head. A later commit invalidates the signal.

Supervisor integration remains:

`exact-head FULL GATE → current lease/slot/dependency review → zero unresolved threads → fresh completion signal → expected-head merge → resulting-main FULL GATE → issue #50 epoch broadcast → branch/lease reconciliation`

After every accepted merge, the Supervisor broadcasts exactly:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Direct pushes to `main`, force resets of standing branches and protection bypasses are prohibited by project governance.

## M01 verification state

### ABD-259 — monorepo foundation / executable CI
State: **VERIFIED / DONE**.

### ABD-260 — PostgreSQL migration / data layer
State: **VERIFIED / DONE**.

### ABD-261 — durable worker / queue foundation
State: **VERIFIED / DONE**.

### ABD-262 — identity / RBAC / tenant primitives
State: **VERIFIED / INTEGRATED**.

### ABD-263 — API / observability / health
State: **VERIFIED / INTEGRATED / DONE**.

### ABD-264 — M01 FULL GATE
State: **VERIFIED / DONE / INTEGRATED AND CONTINUOUSLY RE-RUN**.

### ABD-266 — default-branch protection / compensating controls
State: **NATIVE `main` PROTECTION/RULESET ACTIVE; REPOSITORY PROVENANCE/SECURITY CONTROLS REMAIN DEFENSE IN DEPTH**.

## M02/M02A completion evidence

The completed provider-neutral cycles now cover, at minimum:

- source contracts/admission and source registry persistence;
- SourceTask preflight/lifecycle and provider-neutral execution bridge;
- connector policy/health/quota safety;
- transport admission and deterministic network-destination safety;
- injected test-only transport/resolution, redirect revalidation and bounded audit/observability;
- hostile network/security verification without real hostile network access;
- Research Job Builder contract/preflight;
- durable ResearchJob/AcquisitionShard persistence and checkpoints;
- durable pause/resume/cancel/kill control state;
- provider-neutral acquisition shard orchestration;
- exact tenant-safe acquisition progress/budget observability;
- adversarial recovery, tenant isolation, budget/policy bypass, lifecycle, corruption and telemetry-redaction verification.

M02A completed through PR #131. This completion does **not** activate real provider traffic, production credentials or unrestricted acquisition.

## Deferred Runner benchmark state

Runner-dependent verification now has a durable deferred queue:

- policy: `docs/RUNNER_BENCHMARK.md`;
- machine queue/results: `.agent/runner-benchmark.yaml`;
- executable guard: `pnpm run verify:runner-benchmark` (also included in `pnpm run verify:parallel`);
- current Runner inventory:
  - `RUNNER-WINDOWS-READINESS-001` — Windows x64 runner readiness diagnostics;
  - `RUNNER-M01-WINDOWS-X64-001` — exact-main Windows x64 compatibility benchmark;
- dependency: `RUNNER-WINDOWS-READINESS-001 → RUNNER-M01-WINDOWS-X64-001`.

Normal required PR/resulting-main/security gates remain immediate and cannot be moved into the Runner queue. Applicable deferred tasks are accumulated during development and executed in one controlled milestone-close Runner batch before the relevant milestone/release is finalized.

## M03 completion and verification record

The bounded canonical identity DAG `ER-001 → {ER-002, ER-003} → ER-004`; `ER-002 → ER-005`; `{ER-004, ER-005} → ER-006` is integrated. Migrations `0014`–`0017`, tenant-safe evidence and persistence, deterministic candidate generation, human review thresholds, idempotency, rollback and no-outreach semantics are verified. PR #166's bounded runtime lookup and original ER-006 adversarial tests plus PR #170's hardened CONTRACTS normalizer are merged.

Exact PR and resulting-main FULL GATEs for both integrations passed quality/security, PostgreSQL 18/RBAC, and canonical worker/Valkey lanes. VERIFY issue #167 completed audited owner recovery, non-destructive synchronization and release; CONTRACTS issue #168 completed lease-backed integration and release. Outstanding production provider/contact enrichment activation is an *external authorization/readiness task*, not an unmerged M03 implementation packet.

## Security / authorization boundary

Still separately gated:

- production model/provider invocation and credentials;
- production source-provider HTTP/network/credentials;
- unrestricted acquisition/scraping;
- payment-provider activation;
- autonomous or bulk outreach;
- production deployment/release;
- destructive production data actions;
- unresolved legal/provider/commercial decisions.

M03 identity work must remain tenant-scoped, evidence/provenance aware, deterministic-first, review-aware and reversible where merge/split semantics require it. Parallelism never widens authorization.

## Known limitations

- native GitHub `main` protection/ruleset is active; completed issue #54 is the historical hardening record;
- no production deployment has been proven by these repository gates;
- remote GitHub sessions cannot prove unseen local developer working-copy/runtime/database state;
- provider-neutral seams are not evidence of production provider activation/readiness.

## Next safe actions

1. Maintain resulting-main exact-head gate evidence and reconcile this documentation PR under the Supervisor's own atomic lease; keep issue #50/#53 authoritative for live coordination.
2. Continue the next dependency-safe product milestone (M04) under its own bounded work packets, not by reopening completed M03.
3. Resolve independent DATABASE/MODULE/SUPERVISOR lane-local coordination only when supported by an explicit audit; never silently expire or force-reset another active lease.
4. Keep production provider/network/model/credentials, payment, outreach, unrestricted acquisition and deployment as separate explicit authorizations.
