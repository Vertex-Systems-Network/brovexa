# Brovexa Project Checkpoint

Updated: 2026-09-22

## Project state

`ACTIVE_EXISTING_PROJECT`

- **M01 — Platform Foundation & Developer Experience:** VERIFIED / INTEGRATED.
- **M01A — AI Agent Runtime & Memory OS:** provider-neutral foundation VERIFIED / INTEGRATED / IMPLEMENTATION-COMPLETE. Production model/provider execution remains separately gated.
- **M02 — Business Discovery & Source Connectors:** provider-neutral source/network-safety foundation VERIFIED / INTEGRATED. Real provider HTTP/network/credentials remain separately gated.
- **M02A — Global Acquisition Studio & Background Research:** planned provider-neutral packet sequence `M02A-ACQ-001` through `M02A-ACQ-006` VERIFIED / INTEGRATED. PR #131 completed independent adversarial verification; resulting-main FULL GATE passed all three lanes.
- **M03 — Entity Resolution & Contact Enrichment:** FINAL VERIFICATION. `M03-ER-001` through `M03-ER-005` are integrated, and PR #151 integrated the contract-layer stale-evidence fail-closed fix. Independent verification PR #150 subsequently exposed a persistence-layer freshness bypass: direct durable domain-verification persistence does not yet enforce evidence observation ordering / `refreshAfterSeconds`. DATABASE owns `M03-ER-006-FRESHNESS-PERSISTENCE-FIX`; migration `0016_entity_enrichment_freshness_guard` is reserved for the durable guard. ER-006 remains blocked until that fix is integrated and its unchanged adversarial assertions pass.

The latest reconciled integration snapshot is epoch **77** after PR #151 at main `e760fa797545533517b6de84cc675c4060e3e36e`, with resulting-main CI `35769464173` green. This SHA is checkpoint evidence, not permanent live coordination truth; always resolve the latest issue #50 state before mutation.

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

## M03 current safe plan

Canonical scope from `docs/PROJECT_PLAN.md`:

**Canonical identity, deterministic + structured-AI matching, confidence/review thresholds, reversible merge/split, domain verification and approved contact enrichment.**

Initial bounded DAG is maintained in `docs/AI_NATIVE_PLAN.md`:

`M03-ER-001 → { M03-ER-002, M03-ER-003 } → M03-ER-004`

`M03-ER-002 → M03-ER-005`

`{ M03-ER-004, M03-ER-005 } → M03-ER-006`

`M03-ER-001` through `M03-ER-005` are integrated. Migration `0014_canonical_entity_resolution_persistence` and `0015_entity_enrichment_evidence_persistence` are integrated; `0016_entity_enrichment_freshness_guard` is reserved for the persistence freshness defect found by ER-006. ER-005 persistence preserves tenant isolation, workspace-scoped idempotency, approved provenance, normalized contact values, retention/deletion semantics and an explicit no-outreach boundary. `M03-ER-006` remains the downstream closeout packet after the persistence fix.

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

1. Integrate the bounded Supervisor reconciliation / migration-reservation changeset with exact-head FULL GATE and expected-head merge.
2. Synchronize DATABASE to that resulting main/epoch and implement `M03-ER-006-FRESHNESS-PERSISTENCE-FIX` without modifying integrated migration `0015`.
3. Enforce evidence observation ordering and deterministic `refreshAfterSeconds` freshness in both the persistence API and durable SQL boundary, with focused rollback/regression coverage.
4. Integrate the DATABASE fix only after exact-head FULL GATE, then synchronize VERIFY and rerun PR #150's unchanged adversarial assertions.
5. Close M03 only after ER-006 exact-head and resulting-main FULL GATE are green, with zero unresolved security/review drift.
6. Preserve provider/network/credential/outreach activation as separate explicit gates.
