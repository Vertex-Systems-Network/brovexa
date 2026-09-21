# Brovexa Windows x64 Self-Hosted Runner Readiness

Status: **ACTIVE RUNNER READINESS RUNBOOK**

Purpose: verify that the approved Windows x64 GitHub Actions runner is healthy and eligible to execute the deferred Runner benchmark `RUNNER-M01-WINDOWS-X64-001`.

Canonical Runner governance:

- policy: `docs/RUNNER_BENCHMARK.md`;
- queue/results: `.agent/runner-benchmark.yaml`;
- readiness task: `RUNNER-WINDOWS-READINESS-001`;
- compatibility task: `RUNNER-M01-WINDOWS-X64-001`;
- canonical dispatch workflow: `.github/workflows/m01-self-hosted-dispatch.yml`.

This runbook does **not** authorize runner removal, re-registration, token rotation, organization-policy changes, production deployment, credential expansion, or destructive actions.

## Current operating model

M01 hosted verification is already integrated and continuously enforced. The Windows self-hosted path is an additional deferred compatibility benchmark, not a substitute for hosted PR/resulting-`main` FULL GATE.

The dependency is:

`RUNNER-WINDOWS-READINESS-001 → RUNNER-M01-WINDOWS-X64-001`

Do not dispatch the compatibility benchmark until readiness is confirmed.

## 1. Confirm GitHub runner state

In repository/organization GitHub settings, inspect **Actions → Runners** and find the approved Brovexa Windows runner.

Expected state:

```text
Status: Idle
Labels: self-hosted, Windows, X64
```

Interpretation:

- `Idle` — connected and available;
- `Active` — connected but currently executing work;
- `Offline` — runner application is not connected.

Do not add broad labels or weaken the workflow's exact label requirements merely to obtain assignment.

## 2. Run the read-only diagnostic

From a Windows PowerShell terminal in the Brovexa checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1
```

If the installation root cannot be inferred from the Windows service:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1 -RunnerRoot "C:\path\to\actions-runner"
```

The script is intentionally read-only. It checks:

- `actions.runner.*` service presence/state;
- `Runner.Listener` process visibility;
- installation/registration-file presence without printing registration contents;
- runner binary version;
- latest `_diag` path/time without dumping log contents;
- representative outbound TCP/443 reachability to GitHub endpoints.

It does not start, stop, remove, register, reconfigure, or request runner tokens.

## 3. Resolve service/listener problems safely

If an already-approved Windows service exists but is stopped, inspect it first:

```powershell
Get-Service "actions.runner.*"
```

Starting the already-approved service is an operator action:

```powershell
Start-Service "actions.runner.*"
```

Then verify:

```powershell
Get-Service "actions.runner.*"
Get-Process "Runner.Listener" -ErrorAction SilentlyContinue
```

If the runner intentionally uses an already-approved interactive installation instead of a service, confirm that registration is still valid before using its existing `run.cmd`. Re-registration/token rotation is a separate privileged recovery decision and is not authorized by this runbook.

## 4. Network requirements

The runner needs outbound HTTPS/TCP 443 to GitHub services used by Actions. The diagnostic checks representative endpoints including:

- `github.com`;
- `api.github.com`;
- `codeload.github.com`;
- `results-receiver.actions.githubusercontent.com`;
- `objects.githubusercontent.com`.

A representative PASS does not prove every wildcard/CNAME path is allowed by a corporate firewall.

Do not disable TLS verification as a troubleshooting shortcut.

## 5. Diagnostic-log handling

Runner diagnostics normally live under the installation `_diag` directory. The repository diagnostic prints only the latest file path/time.

Review logs locally for categories such as connection/authentication, DNS/proxy/TLS, auto-update, service-start, or stale registration errors. Do not paste registration tokens, authorization headers, credentials, or other secrets into issues/chat or benchmark result fields.

## 6. Readiness PASS criteria

Mark `RUNNER-WINDOWS-READINESS-001` PASS only when evidence shows:

- approved runner machine is reachable;
- runner service or approved listener mode is healthy;
- `Runner.Listener` is connected;
- GitHub shows exact labels `self-hosted, Windows, X64`;
- GitHub runner state is `Idle` immediately before dispatch;
- registration metadata exists without secret disclosure;
- representative outbound HTTPS checks pass;
- no unresolved runner-allocation blocker remains.

Infrastructure failure is recorded as readiness `FAIL`/`BLOCKED`, not as an application build/test failure.

## 7. Dispatch the exact-main compatibility benchmark

After readiness PASS:

1. re-read current `main` SHA;
2. require current hosted FULL GATE/security checks to be green;
3. open **Actions → M01 Self-hosted Verification Dispatch**;
4. dispatch the workflow with `ref=<exact current main SHA>`;
5. never substitute a stale standing/foundation branch for final-batch evidence.

The canonical dispatch workflow checks out the supplied exact ref and runs foundation/guardrail checks, frozen-lockfile dependency install, runtime quality, and API source-to-runtime reload verification.

The historical `.github/workflows/ci-self-hosted.yml` remains a frozen M01 reference and is **not** the final-batch dispatch source.

## 8. Evidence required

For readiness, record:

- diagnostic outcome;
- runner name and exact labels if visible;
- GitHub runner state;
- unresolved infrastructure blocker, if any.

For compatibility, record:

- exact current-main SHA used as `ref`;
- workflow run ID;
- job ID;
- each executed step/conclusion;
- final workflow conclusion.

Store only evidence references and non-sensitive metrics in `.agent/runner-benchmark.yaml`; do not copy secrets or sensitive logs into the registry.

## 9. Failure classification

Use the actual category:

```text
RUNNER INFRASTRUCTURE / ALLOCATION FAILURE
DEPENDENCY INSTALL FAILURE
FOUNDATION CONTRACT FAILURE
BUILD FAILURE
TYPECHECK FAILURE
TEST FAILURE
API RELOAD VERIFICATION FAILURE
```

A queued/no-step job is not an application failure.

## 10. Final-batch rule

Runner readiness and compatibility are executed during the controlled milestone/release Runner batch defined in `docs/RUNNER_BENCHMARK.md`.

Required hosted PR/resulting-`main`/security gates remain immediate and cannot be deferred into this process.
