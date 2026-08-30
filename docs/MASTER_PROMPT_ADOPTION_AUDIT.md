# Brovexa — Universal Master Prompt Adoption Audit

Status: **PLANNING ONLY — read-only adoption audit followed by governance-plan amendment; no feature implementation authorized**

Audit date: 2026-08-30
Audit owner issue: Linear `ABD-257`
Repository: `Vertex-Systems-Network/brovexa`
Baseline branch: `main`
Planning branch: `planning/brovexa-baseline`
Planning PR: `#1`

## 1. Project-state classification

**Classification: `PLANNED_EXISTING_PROJECT`.**

Evidence:

- `main` still contains only the original `# brovexa` README and remains at the initial implementation baseline.
- Draft PR #1 is open/unmerged and contains planning/documentation changes only.
- The PR file inventory contains `README.md` plus `docs/*`; no application source, package manifest, migration, CI workflow, infrastructure manifest or product runtime file is part of the current planning diff.
- No product feature code is claimed as implemented by the current checkpoint.

This is not `ACTIVE_EXISTING_PROJECT`, `PRODUCTION_PROJECT`, `LEGACY_OR_MIGRATION`, or `RECOVERY`.

## 2. Audit capability declaration

Verified through connected tooling:

- remote GitHub repository metadata/content
- PR state/diff inventory
- commit/CI-status lookups
- Linear project/issues/documents
- internet research when required

Not available/verified in this remote audit:

- a local developer working copy and its `git status`
- uncommitted/staged/untracked files on a developer machine
- local environment variables/secrets
- live database/schema/runtime state
- deployed application/production environment
- deployment platform logs

These items are `UNKNOWN`, not assumed clean or absent. They must be checked when implementation begins or when a local/runtime environment is connected.

## 3. Actual repository baseline

### `main`

Actual implementation state: effectively empty product baseline.

- one initial commit is visible on the default branch
- README content is only `# brovexa`
- no verified product implementation exists on `main`

### `planning/brovexa-baseline`

Current role: planning/architecture/documentation carrier.

PR #1 is intentionally:

- OPEN
- DRAFT
- UNMERGED
- mergeable/clean at the latest verified GitHub state

The current PR diff is documentation-only. Therefore planning documents MUST NOT be interpreted as implemented behavior.

## 4. CI / verification baseline

Current planning-head CI evidence:

- combined commit statuses: none
- pull-request workflow runs for the audited planning head: none

This is not a failed test baseline because product code has not started. However, it creates a **M01 entry requirement**: before substantial product implementation grows, Brovexa needs a reproducible CI baseline capable of recording lint/type/build/test/security results.

No test may later be called PASS unless actual executed evidence exists.

## 5. VCS protection audit

Repository metadata confirms a private GitHub repository with `main` as default branch. The connected GitHub ruleset endpoint returned HTTP 403 because the current GitHub plan/visibility does not expose repository rulesets through that API path.

Therefore the following are `NOT VERIFIED` in this audit:

- branch protection/rulesets
- required reviews/checks
- CODEOWNERS enforcement
- merge queue requirements
- tag/release protections
- deployment approvals

Before development/release, these must be inspected through an available repository-admin path or recorded as deliberately unavailable with compensating controls.

## 6. Plan → repository classification

| Planned domain | Implementation state | Documentation state | Audit conclusion |
| --- | --- | --- | --- |
| Public landing/product website | NOT STARTED | DOCUMENTED | safe planning baseline |
| Login/register/recovery/onboarding | NOT STARTED | DOCUMENTED | provider decision still pending |
| Web operator console | NOT STARTED | DOCUMENTED | IA/contracts exist |
| Desktop application | NOT STARTED | DOCUMENTED | Windows-first/Tauri direction |
| Chrome/Firefox extension | NOT STARTED | DOCUMENTED | shared WXT contract |
| AI Agent OS | NOT STARTED | DOCUMENTED | contracts/evals planned |
| Durable backend memory | NOT STARTED | DOCUMENTED | canonical-vs-memory boundary defined |
| Global geography/taxonomy registry | NOT STARTED | DOCUMENTED | provider/import decisions remain |
| ResearchJob/acquisition runtime | NOT STARTED | DOCUMENTED | source policy and cost gates required |
| Source connectors | NOT STARTED | PARTIALLY DOCUMENTED | exact launch provider field/TTL/export profiles unresolved |
| Evidence/fact/inference model | NOT STARTED | DOCUMENTED | physical DB implementation pending |
| Signal/opportunity engine | NOT STARTED | DOCUMENTED | active launch signal catalog/eval thresholds unresolved |
| Lead Intelligence OS | NOT STARTED | DOCUMENTED | transactional lifecycle planned |
| CRM/import synchronization | NOT STARTED | DOCUMENTED | provider ordering unresolved |
| Outreach execution | NOT STARTED | DOCUMENTED / DEFERRED | autonomous send intentionally not launch default |
| Packages/credits/billing | NOT STARTED | DOCUMENTED | exact economics/provider pending |
| 24-hour Market Intelligence Scout | NOT STARTED | DOCUMENTED / DISABLED | implementation requires later approval |
| Workspace/admin/API/webhooks | NOT STARTED | DOCUMENTED | ABD-256 owns cross-cutting contract |
| CI/CD/deployment | NOT STARTED | PARTIALLY DOCUMENTED | concrete provider/IaC/workflow pending |

No planned runtime module is currently `IMPLEMENTED BUT NOT VERIFIED` or `VERIFIED` because no runtime implementation exists.

## 7. Repository → plan classification

The PR file inventory contains planning documentation only. No undocumented runtime subsystem was found in the audited diff.

Current implementation code therefore has no detected `UNDOCUMENTED` product behavior. This conclusion applies to the remote repository state only; local/uncommitted developer work remains UNKNOWN.

## 8. Existing planning strengths against the Universal Master Prompt

The existing Brovexa Engineering Constitution and M00 plan already strongly cover:

- repository evidence over conversation memory
- documentation-first substantial work
- explicit development authorization gate
- Brovexa-specific source-policy contracts
- facts/evidence/inference separation
- prompt-injection and hostile external-content handling
- AI AgentDefinitions, structured outputs and evaluation governance
- durable memory/checkpoint requirements
- least-privilege agent autonomy
- security baselines and threat modeling
- privacy/suppression/outreach controls
- data integrity and reversible entity-resolution behavior
- durable/resumable jobs and idempotency
- cost/quota controls and Research Credit accounting
- quality gates and risk-based tests
- observability/performance/dependency governance
- multi-client trust boundaries
- daily market-scout governance
- Definition of Ready / Definition of Done
- explicit owner consent before feature implementation

The project should preserve these; the Universal Prompt does **not** justify restarting or replacing the current architecture.

## 9. Governance gaps found

### CORRECTION

#### G-01 — actual-state authority order

The durable governance should explicitly use:

`repository/code → database/schema/config → observed execution → executed tests → CI → VCS history → approved documentation → durable project state → conversation`.

This matters once runtime implementation exists; tests/documentation must not outrank observed production/schema reality.

### COMPLETION

#### G-02 — formal project-state detection

Persist the state taxonomy:

`GREENFIELD / PLANNED_EXISTING_PROJECT / ACTIVE_EXISTING_PROJECT / PRODUCTION_PROJECT / LEGACY_OR_MIGRATION / RECOVERY`.

Current state: `PLANNED_EXISTING_PROJECT`.

#### G-03 — Plan ↔ Reality matrix

Every module/milestone should use:

`NOT STARTED / PARTIALLY IMPLEMENTED / IMPLEMENTED BUT NOT VERIFIED / VERIFIED / DIFFERS FROM PLAN / UNKNOWN`.

Implemented behavior should separately classify documentation as:

`DOCUMENTED / PARTIALLY DOCUMENTED / UNDOCUMENTED / OBSOLETE / UNKNOWN PURPOSE`.

#### G-04 — approval-scope hierarchy

Persist approval scope:

`TASK / MODULE / MILESTONE / PHASE / PROJECT`.

Add explicit state `AWAITING_DEVELOPMENT_APPROVAL` when M00 becomes sufficiently complete.

#### G-05 — remote/local audit boundary

Remote GitHub state cannot prove a developer working copy is clean. Local uncommitted/staged/untracked, merge/rebase state, runtime and DB must be checked when such access exists.

### HARDENING

#### G-06 — small-batch / change-surface contract

Before implementation estimate expected files/modules/APIs/migrations/dependencies/config. If the actual surface expands materially, stop and reassess instead of accepting AI scope creep.

#### G-07 — no unrelated cleanup

Feature work must not become repository-wide reformatting, renaming, dependency upgrades or unrelated refactoring.

#### G-08 — safe parallel-work classification

Every work package should be classified:

`PARALLEL_SAFE / COORDINATED_PARALLEL / SERIALIZE / BLOCKED`.

Shared migrations, auth/authorization core, lockfiles, global contracts, routing, build/CI and global config generally require coordination/serialization.

#### G-09 — baseline-failure policy

Pre-existing failure must be labeled `BASELINE FAILURE` rather than attributed to the current change.

#### G-10 — flaky-test policy

Repeated reruns until green are forbidden as release evidence. Flakiness is itself a defect/risk.

#### G-11 — two-speed verification

Use:

- `FAST GATE` during small implementation batches
- `FULL GATE` at milestone/release boundaries

#### G-12 — release-state vocabulary

Distinguish:

`BUILT / DEPLOYED / RELEASED / PRODUCTION VERIFIED`.

Also classify recovery:

`SIMPLE ROLLBACK / ROLLBACK WITH COMPATIBILITY / FORWARD FIX PREFERRED / IRREVERSIBLE`.

#### G-13 — incident mode

Production incidents follow:

`Stabilize → Contain → Preserve Evidence → Diagnose → Recover → Verify → Root Cause → Prevent Recurrence`.

#### G-14 — STOP-THE-LINE

Immediately stop affected work for unexpected data loss, cross-tenant leak, credential exposure, destructive unknown command, migration corruption, unexplained massive diff, repository state that cannot be understood, or critical security bypass.

#### G-15 — VCS protections as readiness evidence

Branch/ruleset/review/check/release protection state must be auditable before implementation/release. Current ruleset state is NOT VERIFIED due GitHub API plan/visibility limitation.

#### G-16 — CI baseline before product growth

M01 should establish reproducible workflow checks early. Current planning head has no CI checks/runs, which is acceptable only while planning-only.

#### G-17 — end-of-task engineering report

Meaningful engineering work should persist/report:

Status / Changed / Why / Research / Tests-checks / Security / Data-migration / Affected areas / VCS / Documentation-memory / Known issues / Not verified / Next safe action.

## 10. Memory Bank decision

Do **not** blindly create the suggested `.ai/` tree.

Existing Brovexa already has equivalent durable state across:

- `docs/CHECKPOINT.md`
- `docs/PROJECT_PLAN.md`
- `docs/M00_COMPLETENESS_MATRIX.md`
- `docs/CAPABILITY_TRACEABILITY_MATRIX.md`
- architecture/security/module documents
- Linear issues/milestones/status updates
- Git/PR history

Creating ten new `.ai/*` files now would duplicate authority and increase drift risk. Add a new state/index file only if the final ABD-252/ABD-253 audit proves a real missing responsibility.

## 11. Current critical risks / blockers

### BLOCKER before development approval

- ABD-252 exhaustive traceability is still incomplete.
- ABD-253 final adversarial readiness audit is not yet executed.
- ABD-215 explicit readiness/owner approval is not complete.
- Universal Prompt governance deltas in ABD-257 must be adopted or explicitly accepted.

### HUMAN DECISION / material unresolved

- identity provider
- actual hosting/cloud/region/IaC deployment approach
- actual operating legal entity + payment provider onboarding
- exact package Research Credit economics
- exact launch source connector inventory/retention/export rights
- production jurisdiction legal profiles
- AI numeric release thresholds from representative data

### NOT VERIFIED

- local uncommitted/staged/untracked state
- live DB/runtime/deployment state
- repository branch protection/rulesets/required checks due API limitation
- CI quality baseline, because no workflow currently runs on the planning head

## 12. Recommended plan amendments

1. Close `ABD-257` by folding the governance deltas into the canonical engineering constitution/checkpoint/traceability system without duplicating the Memory Bank.
2. Add M01 entry criteria for CI baseline, local repository-state verification and FAST/FULL gates.
3. Add the Plan↔Reality status matrix to the durable checkpoint/module tracking.
4. Add parallel-safety classification to M01+ work packages.
5. Add release/incident/stop-the-line vocabulary before the first production/deployment milestone.
6. Complete ABD-252.
7. Run ABD-253 independently/adversarially.
8. Only then move ABD-215 to `AWAITING_DEVELOPMENT_APPROVAL` and request one meaningful project/milestone development consent.

## 13. Audit verdict

**Architecture/product planning: STRONG, PRESERVE.**

**Implementation readiness: NOT YET APPROVED.**

**Universal Master Prompt adoption: MOSTLY ALIGNED, GOVERNANCE DELTAS REQUIRED.**

**New product scope required by this audit: NONE.**

The safest next action is governance-delta adoption + completion of the existing M00 traceability/adversarial gates, not scaffolding or feature development.