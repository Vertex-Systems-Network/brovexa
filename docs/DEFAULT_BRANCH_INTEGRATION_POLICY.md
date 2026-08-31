# Brovexa Default-Branch Integration Policy

Owner: Linear `ABD-266`
Status: **M01 compensating control while native branch protection is unavailable/unconfigured**

## Verified repository state

Re-verified through GitHub on 2026-08-31:

- `main` head: `69dd5adc3a509aa35b0be46f4e0124d15dc8de3c`
- `protected: false`
- required status checks: off
- `rulesets: none observed`

The connected GitHub surface supports protection/ruleset reads but does not expose a native branch-protection/ruleset write operation. Native protection remains preferred but must not be falsely reported as configured.

## Core rule

`main` is production-history infrastructure even before production exists. Normal M01/product changes must not be written directly to it.

Use:

`short-lived branch → reviewed PR → executable evidence → explicit integration → checkpoint`

## Compensating controls

Until native protection is verified:

1. **No direct feature writes to `main`.**
2. **No force push or shared-history rewrite.**
3. **No auto-merge.**
4. Default-branch changes use a narrowly scoped PR with verified base/head.
5. Any explicit merge must verify the expected PR head SHA immediately before integration.
6. Product/runtime PRs require applicable executable quality/security evidence before merge; plans or unexecuted test files are not green evidence.
7. Bootstrap/infrastructure exceptions must be narrow, reversible, least-privilege, reviewed, and explicitly approved before integration.
8. Planning, product implementation, and default-branch infrastructure remain separate change streams.
9. An accidental direct write is an incident: preserve history, revert safely, document the event, and never hide it with force push/rebase.
10. Required checks may not be bypassed merely to accelerate delivery once executable checks exist.

## Exercised integration evidence

The compensating path has already been exercised on default-branch CI bootstrap/hardening changes:

- reviewed replacement PR #4 was integrated with explicit owner approval and expected-head verification;
- reviewed replacement PR #6 was integrated with explicit owner approval and expected-head verification;
- no auto-merge or history rewrite was used;
- current default-branch self-hosted dispatcher is manual-only and least privilege for the M01 branch.

This proves the compensating workflow can be followed, but it does not turn native protection on.

## Current M01 routing

- PR #1: planning baseline, separate and unmerged.
- PR #2: M01 implementation tracker, draft/unmerged.
- PR #8: verified ABD-262 identity/RBAC/tenant stack, unmerged.
- PR #9: verified ABD-263 API/observability/health stack, unmerged.
- ABD-264 FULL GATE work is stacked from the exact verified ABD-263 head and remains subject to the same review/evidence/integration policy.

## Desired native protection state

When repository permissions/tooling allow, prefer native GitHub protection/rulesets that enforce the intent above, including as appropriate:

- pull-request-based changes to `main`;
- block force pushes and branch deletion;
- required stable quality/security status checks;
- conversation resolution before merge;
- review/ownership rules appropriate to actual team size;
- restricted, auditable bypass capability.

Do not enable a rule that permanently deadlocks a one-maintainer repository without a documented recovery path.

## Self-hosted dispatcher boundary

Default-branch `.github/workflows/m01-self-hosted-dispatch.yml` remains:

- manual `workflow_dispatch` only;
- `contents: read`;
- `[self-hosted, Windows, X64]`;
- immutable Action SHAs;
- `persist-credentials: false`;
- fixed checkout to exactly `m01/platform-foundation`;
- no caller-controlled target ref;
- no deployment/provider secrets.

The implementation-branch `.github/workflows/ci-self-hosted.yml` remains a reference mirror, not an automatic local-runner PR/push workflow.

## ABD-266 exit rule

ABD-266 can leave In Progress only when the M01 FULL GATE records the actual protection state and either:

1. native branch/ruleset protection is verified; or
2. the documented compensating policy is explicitly accepted as the M01 handoff control and its auditable integration path remains enforced.

## Release-state semantics

A merge to `main` is not automatically a release. Brovexa distinguishes:

`BUILT → DEPLOYED → RELEASED → PRODUCTION VERIFIED`

M01 authorizes foundation development only; production deployment remains outside scope.
