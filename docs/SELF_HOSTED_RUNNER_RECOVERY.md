# Brovexa M01 Self-Hosted Runner Recovery

Status: **Operational blocker-resolution runbook**

Purpose: restore an approved Windows x64 GitHub Actions runner to a state where the default-branch `M01 Self-hosted Verification Dispatch` can execute the M01 quality gate.

This runbook does **not** authorize runner removal, re-registration, token rotation, organization-policy changes, production deployment, or any destructive action.

## Current Brovexa evidence

- hosted GitHub Actions repeatedly fail before runner allocation / before executable workflow steps;
- the historical no-checkout Windows probe remains queued;
- GitHub currently shows no `workflow_dispatch` execution for the default-branch M01 dispatcher;
- therefore M01 remains `IMPLEMENTED BUT NOT VERIFIED` and `ABD-259` stays open.

GitHub routes a self-hosted job only to an online/idle runner matching all required labels. The Brovexa dispatcher requires:

```text
self-hosted
Windows
X64
```

If no online/idle runner matches, the job remains queued.

## 1. Inspect the runner in GitHub

In the repository or organization UI:

1. Open **Settings**.
2. Open **Actions → Runners**.
3. Find the approved Brovexa/Windows runner.
4. Confirm its status and labels.

Expected ready state:

```text
Status: Idle
Labels: self-hosted, Windows, X64
```

Interpretation:

- `Idle` — connected and available;
- `Active` — currently executing a job;
- `Offline` — runner application is not connected to GitHub.

Do not create extra labels or weaken the workflow's exact label requirements merely to force assignment.

## 2. Run the repository diagnostic script

From a Windows PowerShell terminal in the Brovexa checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1
```

If the runner installation cannot be inferred from its Windows service, pass its installation directory explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\diagnose-github-runner.ps1 -RunnerRoot "C:\path\to\actions-runner"
```

The script is intentionally read-only. It checks:

- `actions.runner.*` Windows service presence/state;
- `Runner.Listener` process visibility;
- runner installation/registration-file presence without printing registration contents;
- runner binary file version;
- latest `_diag` file path/time without dumping log contents;
- basic outbound TCP/443 reachability to GitHub endpoints.

It does **not** start/stop/remove/register/reconfigure the runner and does not request or print runner tokens.

## 3. If the Windows service exists but is stopped

Inspect:

```powershell
Get-Service "actions.runner.*"
```

GitHub's documented Windows service start command is:

```powershell
Start-Service "actions.runner.*"
```

Starting an already-approved existing runner service is an operator action. Do not run removal/reconfiguration commands merely because a job is queued.

After starting, re-check:

```powershell
Get-Service "actions.runner.*"
Get-Process "Runner.Listener" -ErrorAction SilentlyContinue
```

Then confirm the runner changes to `Idle` in GitHub **Settings → Actions → Runners**.

## 4. If no runner service exists

The runner may have been configured for interactive use rather than as a Windows service, or its registration may be stale.

If an already-configured runner installation exists, open PowerShell in that runner installation directory and use the existing runner application only if its registration is still valid:

```powershell
.\run.cmd
```

A healthy interactive runner reports that it is connected and listening for jobs.

Do **not** remove/re-register the runner as a first troubleshooting step. Registration/reconfiguration requires time-limited GitHub tokens and changes trusted machine state, so it should be treated as a separate explicit recovery decision if the existing registration is proven unusable.

## 5. Network requirements

The self-hosted runner requires outbound HTTPS (TCP 443) to GitHub. GitHub documents essential communication with:

```text
github.com
api.github.com
*.actions.githubusercontent.com
```

The current M01 workflow also downloads GitHub Actions, so connectivity to `codeload.github.com` and relevant GitHub content/result endpoints is required.

The diagnostic script tests representative fixed hostnames. A PASS there does not prove every wildcard/CNAME path is allowed by a corporate firewall.

If the runner is `Offline` despite a running listener process, review network/firewall/proxy/TLS interception before touching registration.

Do not disable TLS certificate verification as a normal fix.

## 6. Review runner diagnostics without leaking secrets

Runner diagnostic logs are normally under the runner installation's `_diag` directory.

The Brovexa diagnostic script prints only the latest diagnostic file path and timestamp. Review the file locally for connectivity/service errors, but do not paste credentials, registration tokens, authorization headers, or other secrets into issues/chat.

Useful categories to look for:

- connection/authentication failure;
- DNS/proxy/TLS failure;
- runner auto-update failure;
- service start failure;
- runner registration no longer recognized.

## 7. Execute the Brovexa verification workflow

Once the approved runner is `Idle` with the exact required labels:

1. Open the repository **Actions** tab.
2. Select **M01 Self-hosted Verification Dispatch**.
3. Choose **Run workflow** from the default branch.
4. Start the workflow.

The workflow itself checks out exactly:

```text
m01/platform-foundation
```

It must not be edited to execute arbitrary PR/ref input on the trusted machine.

## 8. Evidence required from the run

Capture the exact:

- workflow run ID;
- job ID;
- runner name/labels if visible;
- each executed step and conclusion;
- dependency-install result;
- foundation preflight result;
- build result;
- typecheck result;
- Vitest result.

Do not summarize a queued or no-step job as a failed application build.

Use the actual failure category:

```text
CI INFRASTRUCTURE FAILURE
DEPENDENCY INSTALL FAILURE
FOUNDATION CONTRACT FAILURE
BUILD FAILURE
TYPECHECK FAILURE
TEST FAILURE
```

## 9. After the first successful dependency installation

The first approved successful `pnpm install --no-frozen-lockfile` must generate `pnpm-lock.yaml`.

Then, in the same M01 verification work package:

1. commit `pnpm-lock.yaml`;
2. change hosted CI, self-hosted reference workflow, and default-branch dispatcher to:

```text
pnpm install --frozen-lockfile
```

3. rerun the complete quality gate.

A successful non-frozen install alone is not the final Foundation Slice 1 gate.

## 10. ABD-259 exit criteria

Do not close `ABD-259` until all are verified from executable evidence:

- approved runner executes;
- Node 24.20.0 / pnpm 11.23.0 environment is used;
- dependency install succeeds;
- lockfile is committed;
- CI is frozen-lockfile-only;
- foundation preflight passes;
- build passes;
- TypeScript 7 typecheck passes;
- Vitest passes;
- `pnpm run dev:api` source-to-runtime restart behavior is exercised;
- GitHub/Linear/checkpoint evidence is reconciled.

Only after this gate should `ABD-260` PostgreSQL/Drizzle implementation start.
