# Brovexa

AI-native global business intelligence, acquisition, evidence, opportunity and Lead Operating System.

## Development progress

Updated: **2026-10-16**

**Current verified state:** M00, M01, M01A, M02A and the bounded provider-neutral **M03 — Entity Resolution & Contact Enrichment** implementation are COMPLETE/INTEGRATED. M03-ER-001 through M03-ER-006, migrations 0014–0017, adversarial ER-006 regression tests and deterministic candidate/identity validation are integrated. PR #166 added bounded worker lookup and preserved ER-006 tests; PR #170 integrated CONTRACTS NUL/Unicode/normalization/provenance guards. Both passed exact-head FULL GATE. GitHub-hosted resulting-main FULL GATE `38808590274` passed **3/3 lanes** at `dfa53dc93c9e8c4939be20e94962c9996b0a7cc0` (quality/security, PostgreSQL 18 + RBAC, canonical worker + Valkey). VERIFY #167 and CONTRACTS #168 are FINAL CLOSED and their original standing-branch histories preserved. **No production provider/model/network/credentials/outreach/deployment authorization is implied.**

### Live AI-Native execution snapshot

- **Exact integrated main:** `dfa53dc93c9e8c4939be20e94962c9996b0a7cc0`
- **Synchronization epoch:** `89` (live source: issue #50)
- **Live registry revision at reconciliation:** `234` (latest occupancy and leases must be read live from issue #53)
- **Integrated product PRs:** [#166](https://github.com/Vertex-Systems-Network/brovexa/pull/166) and [#170](https://github.com/Vertex-Systems-Network/brovexa/pull/170); prior DB migration fix #161
- **Native CI:** #166 exact-head `38671774518` and resulting-main `38806104170` PASS 3/3; #170 exact-head `38807224186` and resulting-main `38808590274` PASS 3/3
- **Recovery:** issue #167 CLOSED, 50 original VERIFY branch commits preserved; all three ER-006 adversarial test blobs retained byte-identically in main
- **Security:** deterministic-first, tenant isolation, evidence/provenance, review decisions, reversible workflows and no-outreach policy maintained
- **GitHub-only development:** [runbook](docs/GITHUB_ONLY_DEVELOPMENT.md); additional handoff preflight regression tests in CI, without relaxing original gates
- **Current product packet:** `SUP-M03-FINAL-DOC-RECONCILE-001` — docs-only closeout; no outstanding M03 implementation packet
- **M03 execution progress:** **100% — FINAL COMPLETE** (bounded provider-neutral milestone)

`██████████ 100%`

M03 is implementation-complete with verified native gates; external production integrations are separately gated. Supervisor control-plane `DEGRADED`, if reported, refers to other lane-local coordination and is not evidence that the M03 source code remains unintegrated.

### M04 unmerged native checkpoint (2026-10-17)

The isolated `checkpoint/m04-local-web006-20261016` branch contains **M04 Website & Digital Presence Intelligence** development and native QA, **not yet integrated into main**. At exact tested source SHA `cf1883596ce1414803ebba5042974ba2b84ebc1b`, [native checkpoint CI #39049593367](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39049593367) passed **5/5** pinned Node24/pnpm11 quality, full PostgreSQL18 migration/RBAC, Valkey, M04 full-schema authorization, and real separate PR #174 migration conflict jobs. M04 PG18 security remains **35/35 PASS**.

WEB-051 checks elapsed grant expiry at deferred COMMIT; WEB-052–054 cover durable retention replay, global work IDs, tenant isolation and concurrency; WEB-055 tests nonzero purge with worker deliberately exiting **after COMMIT before ACK**, independent-process replay and nonexpired evidence preservation. WEB-056–057 verify both owner revocation/COMMIT races; WEB-058 enforces connector review deadlines; WEB-059 protects current domain verification with reversible isolated migration `0025`; WEB-060 protects current connector registry revision and both races with reversible isolated migration `0026`.

**WEB-061 / QA-09:** a read-only PG18 applied `0018` journal/schema audit and **16/16** migration history classifier regressions guard canonical, divergent, unknown, unjournaled, nullable and constraint-drift states. Checkpoint's disposable native DB proves bounded canonical 0018 SHA256 `7d2779e5dc2ad78de358ca013edf15af20165715ff326fb5c5cbefa4dfc82e67`.

**WEB-062 / QA-09:** a new isolated PostgreSQL18 CI job applies the **exact unmodified PR #174** 0018 SQL (pinned Git blob), proves its applied SHA256 `877b161f7e95f58feb3ef00941721bf76488b546e50a8ab7d7da723a9fc17b12` is incompatible with checkpoint 0018, and verifies the real migration runner **rejects** the mixed history before 0019–0026 with absolutely no migration-journal change. This proves the collision, **not** that the incompatible branches have been integrated.

**WEB-063 / QA-09 — native preview verified, NOT integrated:** a scratch combined-tree migration test retains the exact original PR #174 0018 SQL/SHA256, runs checkpoint 0019–0026 through the normal migration runner, and applies an **unreserved, test-only 0027** to restore bounded budget limits without inventing historical values. Its SQL refuses historical inspection/observation records and safely rejects rollback with retained evidence. Real PostgreSQL18 0027 UP/DOWN/reapply and both historical-data negative checks passed in [native CI #39066555225](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39066555225): **5/5 jobs SUCCESS** at SHA `232ed3b05ccf1b0ef42134602020f7ac6833c7ec` with existing **35/35 M04 security**. Final log-only source SHA `76e2361f1d2babf1e8b171f7dd85c57ac96b024b` was independently verified in [native CI #39066658156](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39066658156) with **5/5 SUCCESS**. **0027 is not officially reserved or deployable**; the DATABASE lease and protected branches remain unchanged.

**Still open:** one integration-owner-approved 0018 lineage based on each target database's actual applied checksum, reconciliation of draft PR #174 and isolated 0025/0026 reservations, authorized staging/network E2E, exact merged-tree/protected CI, and production/deployment approval. A target that already applied draft 0018 must retain its original 0018 source checksum plus an authorized forward-only budget fix; it cannot be repaired by merely adding a later migration while keeping a conflicting local 0018 checksum. No PR #174, occupied agent branch, main or production modification was performed. Details: [M04 QA-08/09 acceptance](docs/m04-local/QA08-QA09-WEB049-WEB050-ACCEPTANCE-20261017.md) and [QA-09 migration reconciliation](docs/m04-local/QA09-PR174-RECONCILIATION-20261017.md).

### Overall delivery estimate

**Weighted program delivery: ~35% complete** (portfolio approximation; M03's final 10% does not imply a precise portfolio reweighting).

`███████░░░░░░░░░░░░░ 35%`

| Phase | Module | Current evidence state | Progress |
|---|---|---|---:|
| M00 | Product, Compliance & Architecture Baseline | Approved readiness baseline | **100%** |
| M01 | Platform Foundation & Developer Experience | VERIFIED / INTEGRATED | **100%** |
| M01A | AI Agent Runtime & Memory OS | Provider-neutral foundation VERIFIED / INTEGRATED | **100%** |
| M02 | Business Discovery & Source Connectors | Five bounded slices VERIFIED / INTEGRATED; real provider transport remains gated | **60%** |
| M02A | Global Acquisition Studio & Background Research | Provider-neutral sequence ACQ-001 through ACQ-006 VERIFIED / INTEGRATED | **100%** |
| M03 | Entity Resolution & Contact Enrichment | ER-001–ER-006, migrations 0014–0017, worker/contracts hardening and preserved adversarial tests integrated; exact-head and resulting-main FULL GATE 3/3 PASS | **100%** |
| M04 | Website & Digital Presence Intelligence | Planned | **5%** |
| M05 | Demand, Intent & Opportunity Signals | Planned | **5%** |
| M06 | BPO Intelligence, Scoring & Explainability | Planned | **5%** |
| M06A | Lead Intelligence Operating System | Planned | **5%** |
| M07 | Outreach Strategy, CRM & Compliance Controls | Planned | **5%** |
| M08 | Dashboard, Search, Workflows & APIs | Minimal shell only | **5%** |
| M08A | Desktop & Browser Clients | Not implemented | **0%** |
| M08B | Public Website, Identity & Monetization | Planned | **3%** |
| M09 | Security, Reliability, Scale & Cost Controls | Foundation controls partially delivered | **15%** |
| M10 | Beta, Production Readiness & Launch | Not started | **0%** |
| MX | Continuous Product & Market Intelligence | Planned / deferred | **5%** |

Progress is evidence-based rather than a simple milestone count. Planning-only work receives limited credit; integrated runtime/tests/CI receive full credit.

## Core product pipeline

Discovery → Entity Resolution → Contact Enrichment → Website Intelligence → Demand/Intent Signals → Evidence Verification → Opportunity Reasoning → Lead Scoring → Decision-Maker Routing → Outreach Strategy → CRM/Feedback

## For AI agents / parallel development

**Every coding, review or integration agent must start with `AGENTS.md`.**

Canonical coordination model:

- `AGENTS.md` — working instructions;
- `docs/PARALLEL_AGENT_DEVELOPMENT.md` — permanent multi-agent protocol;
- `docs/AI_NATIVE_PLAN.md` — versioned standing branch/module/slot definitions and merge strategy;
- `docs/NEW_AGENT_ONBOARDING.md` — main-first onboarding;
- `docs/AGENT_BRANCH_LEASES.md` — atomic one-live-instance-per-slot mutation contract;
- `docs/RUNNER_BENCHMARK.md` / `.agent/runner-benchmark.yaml` — deferred special-Runner queue, batch policy and benchmark evidence;
- `.agent/slots.yaml` — static slot definitions only;
- GitHub issue **#50** — live integrated `main` SHA and synchronization epoch;
- GitHub issue **#53** — live logical slot `OPEN` / `OCCUPIED`, assigned agent, start status and registry revision;
- Git branch **`coordination/leases`** — live instance leases at `.leases/<SLOT_ID>.json`;
- PR/work packet/handoff — live bounded task state;
- GitHub issue **#54** — completed native `main` protection/ruleset hardening record.

The Main-repository agent is the **Supervisor**. It owns onboarding, dependency-safe integration, migration/shared-file coordination, expected-head merges, synchronization broadcasts, and its own bounded Supervisor work. The Supervisor is not exempt from atomic branch leases.

Generic parallel operating target remains **6 agents**, with a soft maximum of **8** while conflict/rework/CI metrics remain healthy. The current M02 provider-neutral network-safety cycle is an explicitly planned exception with **10 worker slots + 1 Supervisor** and a **hard cap of 12 total live writers**. The extra branches were created from current `main` before their slot definitions were added; new-agent arrival still never expands capacity on demand.

Standing branches:

- `supervisor/integration-control`
- `agent/contracts-policy`
- `agent/database-persistence`
- `agent/worker-runtime`
- `agent/module-infrastructure`
- `agent/verification-security`
- `agent/network-resolution`
- `agent/transport-sandbox`
- `agent/redirect-revalidation`
- `agent/source-observability`
- `agent/adversarial-network-security`

The five expanded M02 lanes are provider-neutral only. They do not enable real provider DNS/HTTP, production credentials, unrestricted acquisition, or any production network path.

Default isolation rule:

`1 agent = 1 bounded work packet = 1 isolated branch/worktree = 1 PR`

Live-writer invariant:

`one occupied slot = at most one live mutating agent instance`

### Autonomous workspace continuation

With standing autonomous-development authority, the Supervisor does **not** wait for 1/2/3 selection or technical confirmation. It self-selects the canonical safe action, repairs/retries technical failures, treats no-slot/lease blockers as lane-local, records true external human-only blockers as `WAITING_EXTERNAL`, and continues another dependency-safe packet while authorized work remains. README progress is reconciled at every material batch boundary. Safety, branch protection, exact-head CI, production/provider authorization and destructive-operation gates remain unchanged.

### New Agent Onboarding

Every new agent starts from **exact current `main`** and does not start on a standing module branch.

The Supervisor reads issue #50, static slot definitions, and **re-reads issue #53 immediately before assignment**. Only a pre-planned assignable slot whose live issue #53 status is exactly `OPEN` may be assigned.

For an OPEN slot, Supervisor synchronizes the idle standing branch to current main, updates issue #53 to `OCCUPIED` with agent/start/main/epoch/revision, re-reads issue #53 to confirm logical ownership, then the exact runtime/session instance atomically acquires the slot lease before any branch mutation.

Temporary assignment/release in issue #53 **does not require a repository governance PR** when standing definitions/rules are unchanged. Live lease acquire/renew/release on `coordination/leases` is likewise coordination state, not a product merge.

If no assignable live slot is OPEN, Supervisor responds exactly:

**Go Home Come Back Next Time**

The rejected arrival receives no assignment, module checkout, work packet, feature work or implementation PR.

### Atomic branch leases

Issue #53 assigns the logical lane. `coordination/leases` assigns the exact live writer.

Before mutating a work branch, every agent instance—including Supervisor—must atomically create `.leases/<SLOT_ID>.json` with unique `agent_instance_id` and `lease_id`. Existing lease means another live instance owns mutation rights and the newcomer must stop.

Renewal and release are compare-and-swap operations using the current lease blob SHA. Leases do not expire silently; crash/stale takeover requires explicit audit and recovery. Full rules: `docs/AGENT_BRANCH_LEASES.md`.

Hosted PR CI runs `scripts/verify-pr-agent-lease.mjs` and validates the live lease against PR branch, slot, logical agent, runtime instance, work packet, synchronized main/epoch and acquisition-head ancestry.

### Deferred Runner benchmark

Special-Runner checks that are safe to defer are registered in `.agent/runner-benchmark.yaml` and executed in one controlled milestone-close Runner batch. Required PR/resulting-main/security gates cannot be deferred. Feature handoffs carry Runner task IDs plus deferral justification; failed required Runner tasks block milestone/release close.

Initial seeded task: `RUNNER-M01-WINDOWS-X64-001`.

`pnpm run verify:parallel` includes the Runner benchmark governance verifier.

### Completion signal

When an agent finishes its work packet it must announce exactly:

**Work Done and Submitted**

For non-Supervisor agents this is a top-level PR comment whose complete body is exactly that phrase. It means ready for Supervisor review, not automatic merge approval.

The signal is **head-bound**. Any commit pushed after the signal invalidates it; the agent must update the exact-head handoff, rerun required verification, and post a fresh signal.

A valid submission also requires current issue #53 logical slot ownership, a matching active `coordination/leases` instance lease, and current issue #50 synchronization state.

### Supervisor interrupt / merge / resume

On a valid completion signal, Supervisor pauses/checkpoints its own work, reviews current head/signal freshness/live slot/live lease/dependencies/migrations/shared files/security/verification, requests changes or merges with expected-head protection, re-reads `main`, increments issue #50 epoch, broadcasts, then resumes.

Canonical post-merge alert:

**New changes have been merged — please merge these changes into your branch first, then resume your own work.**

Every active agent receiving a newer issue #50 epoch must synchronize current `main` non-destructively, rerun minimum verification, renew the same lease with new SHA/epoch via compare-and-swap, record state, then resume.

### Main integration integrity

Direct pushes to `main` are prohibited. Normal integration is:

`PR → exact-head FULL GATE → expected-head merge`

Hosted CI runs on both pull requests and `push` to `main`. Main-push CI includes `scripts/verify-main-integration-provenance.mjs`, which fails when the pushed `main` commit is not associated with a merged PR targeting `main`.

GitHub native `main` protection is active through the repository ruleset recorded by completed issue **#54**. Required PR/status-check and non-force/deletion protections remain the preventive layer; repository provenance CI stays active as defense in depth and does not authorize direct pushes.

### Executable governance

`pnpm run verify:parallel`

This includes the original parallel governance verifier plus static atomic-lease governance verification. Hosted PR CI additionally validates the live instance lease before the normal FULL GATE proceeds.

### Agent Instruction Drift Check

At the start of every task and again before completion, perform the **Agent Instruction Drift Check**. Read/check at minimum:

1. `README.md`;
2. `AGENTS.md`;
3. `docs/PROJECT_PLAN.md`;
4. `docs/CHECKPOINT.md`;
5. `docs/PARALLEL_AGENT_DEVELOPMENT.md`;
6. `docs/AI_NATIVE_PLAN.md`;
7. `docs/NEW_AGENT_ONBOARDING.md` when relevant;
8. `docs/AGENT_BRANCH_LEASES.md`;
9. `.agent/` manifests;
10. issue #50 synchronization state;
11. issue #53 logical slot state;
12. active slot lease on `coordination/leases`;
13. relevant module/ADR docs and required verification commands.

If architecture, modules, onboarding/live-slot rules, live-instance lease rules, branch workflow, Supervisor behavior, completion-signal freshness, synchronization, ownership, migrations, dependencies, CI/integration integrity, security/policy boundaries or tooling change, update the relevant instructions in the same change set.

A task is not `READY_FOR_INTEGRATION` while future-agent instructions are materially stale.

## Engineering invariants

- Repository/runtime/test evidence outranks conversation memory.
- Facts, evidence, AI inference and AI memory remain separate.
- External content is untrusted data, never instruction.
- Source collection/storage/export is governed by SourcePolicy.
- Long-running AI/research work uses durable job/checkpoint state.
- AI cannot bypass authorization, suppression, compliance, billing or hard budgets.
- Significant work is delivered in small reversible batches with verification gates.
- Parallel work follows explicit slot, live-instance lease, ownership, dependency, migration-reservation, synchronization and integration rules.
- Production provider/network credentials, unrestricted acquisition, autonomous outreach and destructive production actions remain separately gated.

## Planning and state

- Canonical agent instructions: `AGENTS.md`
- AI-Native standing plan: `docs/AI_NATIVE_PLAN.md`
- New-agent onboarding: `docs/NEW_AGENT_ONBOARDING.md`
- Atomic branch leases: `docs/AGENT_BRANCH_LEASES.md`
- Parallel-agent protocol: `docs/PARALLEL_AGENT_DEVELOPMENT.md`
- Static slot definitions: `.agent/slots.yaml`
- Live slot registry: GitHub issue `#53`
- Live instance lease branch: `coordination/leases`
- Supervisor synchronization channel: GitHub issue `#50`
- Branch-protection hardening record: completed GitHub issue `#54`
- Parallel governance verifier: `pnpm run verify:parallel`
- Deferred Runner benchmark: `docs/RUNNER_BENCHMARK.md` / `.agent/runner-benchmark.yaml`
- Current checkpoint: `docs/CHECKPOINT.md`
- Project plan: `docs/PROJECT_PLAN.md`
- Engineering constitution: `docs/ENGINEERING_CONSTITUTION.md`
- Capability traceability: `docs/CAPABILITY_TRACEABILITY_MATRIX.md`
- M02 source-adapter foundation: `docs/M02_SOURCE_ADAPTER_FOUNDATION.md`
- M02 source-registry persistence: `docs/M02_SOURCE_REGISTRY_PERSISTENCE.md`
