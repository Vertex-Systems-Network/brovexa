# Brovexa Default-Branch Integration Policy

Owner: Linear `ABD-266`
Status: **M01 compensating control while native branch protection is unavailable/unconfigured**

## Verified repository state

On 2026-08-30 the GitHub branch API reported `main` as:

- `protected: false`
- required status checks: off

The current connected GitHub toolset supports protection/ruleset reads but does not expose a protection-write operation. Native protection therefore remains preferred but is not falsely claimed as configured.

## Core rule

`main` is production-history infrastructure even before production exists. Normal M01/product changes must not be written directly to it.

Use:

`short-lived branch → reviewed PR → executable evidence where applicable → explicit integration → checkpoint`

## Compensating controls

Until native protection is verified:

1. **No direct feature writes to `main`.**
2. **No force push or shared-history rewrite.**
3. **No auto-merge.**
4. Default-branch changes use a narrowly scoped PR with a verified base/head.
5. Any merge operation must provide/verify the expected PR head SHA immediately before integration.
6. Product/runtime PRs require the applicable executable quality gate before merge; a planning document or unexecuted test file is not green evidence.
7. A CI/bootstrap-only PR may be considered separately when the CI infrastructure itself is the blocker, but it must:
   - contain no product behavior,
   - contain no secrets/deployment action,
   - use least-privilege permissions,
   - receive a recorded review,
   - remain reversible,
   - have an explicit owner/integration decision before merge.
8. Planning PR #1, M01 implementation PR #2 and default-branch CI bootstrap PR #3 remain separate change streams.
9. An accidental direct write is an incident: preserve history, revert safely, document the event, and do not hide it with force push/rebase.
10. Required checks may not be bypassed merely to accelerate delivery once executable checks are available.

## Current PR routing

### PR #1 — Planning baseline

- base: `main`
- scope: planning/documentation
- remains separate from runtime implementation

### PR #2 — M01 platform foundation

- base: `planning/brovexa-baseline`
- head: `m01/platform-foundation`
- scope: M01 runtime/quality foundation
- remains draft/unmerged while `ABD-259` lacks dependency/build/type/test execution evidence

### PR #3 — Default-branch self-hosted dispatch bootstrap

- base: `main`
- head: `m01/ci-dispatch-bootstrap`
- scope: exactly one manual-only workflow enabling `workflow_dispatch` from the default branch
- no product code, database, deployment, source connector, billing, outreach or Market Scout behavior
- no auto-merge
- requires explicit integration decision because it changes default-branch CI surface

## Desired native protection state

When repository plan/permissions allow, prefer native GitHub protection/rulesets that enforce the intent above, including as appropriate:

- pull-request-based changes to `main`
- block force pushes and branch deletion
- required quality/status checks once stable/executable
- conversation resolution before merge
- review/ownership rules appropriate to the actual team size
- restricted bypass capability

Do not enable a rule that permanently deadlocks a one-maintainer repository without a documented recovery path.

## CI-specific bootstrap exception

The current hosted-runner blocker prevents normal executable checks before a default-branch dispatcher exists. A one-file manual dispatcher may therefore be integrated before product CI is green only if all of these are true:

- failure is verified as runner/infrastructure rather than application failure;
- workflow is manual-only;
- GitHub token permissions are least privilege;
- self-hosted execution is limited to trusted M01 refs;
- action dependencies are immutable-pinned;
- checkout credentials are not persisted;
- no secrets or deployment credentials are needed;
- PR diff has recorded SELF REVIEW;
- owner explicitly authorizes the default-branch integration.

This exception does not authorize merging PR #2 or later product changes without executable evidence.

## Release-state semantics

A merge to `main` is not automatically a release. Brovexa continues to distinguish:

`BUILT → DEPLOYED → RELEASED → PRODUCTION VERIFIED`

M01 currently authorizes foundation development only; production deployment remains outside scope.
