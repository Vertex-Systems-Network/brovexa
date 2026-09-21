# Brovexa Deferred Runner Benchmark

Status: **ACTIVE ENGINEERING GOVERNANCE**

This document defines the repository-wide policy for work that specifically requires a self-hosted, OS-specific, hardware-specific, privileged, paid, or otherwise special Runner and therefore should not interrupt normal bounded development.

The authoritative machine-readable queue is `.agent/runner-benchmark.yaml`.

## Purpose

Runner-dependent checks are accumulated in one durable benchmark queue and executed in a controlled **final Runner batch** instead of being repeatedly rediscovered or run ad hoc throughout feature development.

"Batch" means one deliberate milestone-close verification window. It does **not** require unsafe literal parallel execution; the Supervisor may serialize tasks that share an exclusive runner, scarce resource, credential boundary, or destructive test environment.

## Non-deferrable gates

The Runner benchmark is not a way to bypass repository quality or security controls.

The following may **not** be deferred into the Runner queue:

- required PR or resulting-`main` status checks;
- secret scanning, dependency audit, provenance, tenant/RBAC, migration or queue gates required by current CI;
- a security test required to prove a changed authorization/network/credential boundary before merge;
- any check explicitly required by the active work packet for `READY_FOR_INTEGRATION`;
- a test whose absence would make the current merge unsafe.

If a required gate cannot run, the work packet remains blocked. It is not converted into a deferred Runner task.

## What belongs in the benchmark

A task belongs in the queue when it requires a special runner/environment and can safely be postponed without weakening the current merge gate, for example:

- self-hosted Windows/macOS/Linux runner compatibility;
- architecture-specific verification such as x64/ARM;
- GPU, browser-farm, device-lab or hardware-attached checks;
- long benchmark/performance suites intentionally reserved for milestone close;
- isolated external integration runners whose credentials or network boundary are separately controlled;
- release-candidate checks that are required before milestone/release finalization but not before every feature merge.

## Registration rule

Any agent discovering a Runner-dependent task must register/request it **before claiming that task is complete**.

Every queue entry records at minimum:

- stable Runner task ID;
- title and source work packet;
- current status;
- runner profile;
- execution mechanism/workflow;
- exact command or dispatch action;
- prerequisites;
- pass criteria;
- security classification;
- when the task becomes blocking;
- last execution result/evidence.

Feature agents normally request the entry in their handoff/PR. The Supervisor owns the shared queue and de-duplicates equivalent requests.

IDs are stable and are never silently reused. Completed results remain as benchmark history rather than being deleted.

## Canonical states

- `DEFERRED` — valid Runner task recorded for the final batch;
- `READY_FOR_BATCH` — prerequisites satisfied and task can be dispatched;
- `RUNNING` — currently executing;
- `PASS` — required benchmark criteria passed;
- `FAIL` — executed and failed; dependent milestone/release close is blocked;
- `BLOCKED` — cannot execute because a declared prerequisite is unavailable;
- `SUPERSEDED` — replaced by another stable task ID with rationale/evidence.

## Development flow

During normal development:

1. implement and run all ordinary required tests/gates now;
2. detect whether any remaining check truly requires a special Runner;
3. if yes, add/request a Runner benchmark entry before handoff;
4. continue development only when the deferred check is not a current merge/security gate;
5. include Runner task IDs and deferral justification in the PR handoff;
6. do not mark the deferred Runner task itself as passed.

At milestone close:

1. Supervisor freezes the Runner queue for the milestone;
2. re-read current `main`, issue #50, issue #53, leases, open PRs and required CI;
3. require ordinary hosted FULL GATE/security checks to be green first;
4. move eligible entries to `READY_FOR_BATCH`;
5. execute the full milestone Runner batch using the declared runner profiles;
6. record result, main SHA, evidence URL/log reference and relevant benchmark metrics;
7. any `FAIL` or release-blocking `BLOCKED` task prevents milestone/release finalization;
8. after all required entries are `PASS` or explicitly `SUPERSEDED` with evidence, close the Runner batch.

## Initial registered task

The existing M01 Windows x64 self-hosted workflow is registered as the first benchmark task rather than being duplicated from its reference mirror.

Canonical dispatch workflow:

`.github/workflows/m01-self-hosted-dispatch.yml`

The batch dispatch must pass the **exact current `main` SHA** through the workflow `ref` input; a stale standing/foundation branch is not acceptable benchmark evidence.

Reference mirror:

`.github/workflows/ci-self-hosted.yml`

See `.agent/runner-benchmark.yaml` for current state and execution metadata.

## Security boundaries

Runner batching never activates production credentials, provider/network access, unrestricted acquisition, payment actions, autonomous outreach, destructive production actions, or release/deployment by implication.

Special runners must follow least privilege, pinned dependencies/actions, repository branch/lease rules, and explicit credential/network authorization. Secrets and sensitive output must not be written into benchmark result fields.

## Executable governance

Run:

`pnpm run verify:runner-benchmark`

The standard parallel governance command also includes this verifier:

`pnpm run verify:parallel`

Hosted CI runs the verifier on every PR and push to `main`.
