# Brovexa Default-Branch Integration Policy

Owner: Linear `ABD-266`
Status: **M01 exit satisfied via compensating control; native protection remains unavailable/unconfigured**

## Verified repository state

Re-verified through GitHub after M01 integration on 2026-08-31:

- `main` head before this checkpoint PR: `c82c46649033988c5f90d0e4407a47d02aab4d8a`
- `protected: false`
- required status checks: off
- `rulesets: none observed`

The connected GitHub surface supports protection/ruleset reads but does not expose a native branch-protection/ruleset write operation. Native protection remains preferred and is not falsely reported as configured.

## Core rule

`main` is production-history infrastructure even before production exists.

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
8. Planning, product implementation, and default-branch infrastructure remain auditable change streams.
9. An accidental direct write is an incident: preserve history, revert safely, document it, and never hide it with force push/rebase.
10. Required checks may not be bypassed merely to accelerate delivery once executable checks exist.

## Exercised integration evidence

The compensating path has now been exercised for both default-branch infrastructure and the full M01 integration:

- PR #4: reviewed CI bootstrap integration with explicit approval and expected-head verification;
- PR #6: reviewed least-privilege dispatcher hardening with explicit approval and expected-head verification;
- PR #12: same-head planning-baseline replacement integrated separately from runtime code;
- PR #11: exact frozen FULL-GATE stack integrated to `m01/platform-foundation` with expected-head verification;
- PR #13: verified M01 runtime/foundation integrated to current `main` with expected head `825bddeb00a2d571e5e8132b077fb9707b2021e0` after current-main merge-context run `33406039572` fully passed;
- no auto-merge or history rewrite was used.

PR #13 produced `main` commit `c82c46649033988c5f90d0e4407a47d02aab4d8a` and preserved both the planning/default-branch infrastructure ancestry and verified M01 ancestry.

This proves the compensating workflow can be followed; it does not turn native protection on.

## M01 integration routing

- original PR #1: closed unmerged; superseded by same-head planning PR #12;
- PR #12: merged planning baseline;
- PR #11: merged consolidated verified M01 stack into `m01/platform-foundation`;
- PR #13: merged verified M01 foundation to `main`;
- legacy PRs #2/#8/#9/#10 are superseded integration artifacts and can be closed unmerged with references to #11/#13;
- this post-integration checkpoint uses a separate docs-only PR and normal hosted CI.

## Desired native protection state

When repository permissions/tooling allow, prefer native GitHub protection/rulesets that enforce, as appropriate:

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

PR #13's test merge commit was directly inspected and confirmed this default-branch-only workflow remained present through M01 integration.

Because M01 is now on `main`, hosted `.github/workflows/ci.yml` is the authoritative ongoing PR verification path. The manual M01 dispatcher is a historical diagnostic/fallback surface until separately retired or retargeted; changing it requires its own reviewed PR.

The implementation-branch `.github/workflows/ci-self-hosted.yml` remains a reference mirror, not an automatic local-runner PR/push workflow.

## ABD-266 exit rule

ABD-266 is **Done via the documented compensating-control alternative** because:

1. M01 FULL GATE recorded the actual native protection state;
2. the compensating policy was accepted and repeatedly enforced;
3. the default-branch integration path is auditable; and
4. final M01 integration followed expected-head/no-auto-merge/no-history-rewrite controls.

Native protection remains future hardening, not a falsely satisfied control.

## Release-state semantics

A merge to `main` is not automatically a release. Brovexa distinguishes:

`BUILT → INTEGRATED → DEPLOYED → RELEASED → PRODUCTION VERIFIED`

M01 is now **BUILT + INTEGRATED**. Production deployment and later provider/source/payment/outreach gates remain outside M01 scope.
