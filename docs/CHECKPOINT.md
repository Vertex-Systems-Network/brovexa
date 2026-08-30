# Brovexa Project Checkpoint

Updated: 2026-08-30

## Project state

`ACTIVE_EXISTING_PROJECT`

Brovexa moved from planning-only to active implementation after explicit owner approval for **M01 — Platform Foundation & Developer Experience**.

## Authorization

Approved scope: **M01 milestone**.

Not authorized by this approval:
- production payment-provider activation
- production source connector enablement
- unrestricted internet acquisition
- autonomous/bulk external outreach
- Daily Market Intelligence Scout activation
- production deployment
- destructive data actions
- bypassing unresolved legal/provider/commercial gates

## VCS state

- default branch: `main`
- planning branch: `planning/brovexa-baseline`
- planning PR: #1, draft/unmerged
- implementation branch: `m01/platform-foundation`
- implementation PR: #2, draft/unmerged
- Foundation Slice 1 initial runtime commit: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`
- implementation head immediately before this checkpoint update: `f6442d73ff8132ed90435acc0b03e7824c802b59`

Local developer working-copy/uncommitted/runtime/DB state remains `UNKNOWN` because canonical repository writes are being performed through remote GitHub tooling.

### VCS routing incident record

Two earlier temporary diagnostic writes were accidentally routed and immediately reverted without rewriting history:
- `docs/ci-command-audit.tmp` on `main`
- `never-use` on `m01/platform-foundation`

They have no net repository-content effect and are not implementation evidence.

## M00 state

M00 readiness/governance is complete for entering M01:
- `docs/ENGINEERING_CONSTITUTION.md` v1.2
- `docs/CAPABILITY_TRACEABILITY_MATRIX.md` v1.0
- `docs/M00_FINAL_READINESS_AUDIT.md`
- Linear `ABD-215`, `ABD-252`, `ABD-253`, `ABD-257` completed

Later vendor/legal/commercial decisions remain explicit gates for the capabilities that require them.

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`
Parallel classification: `SERIALIZE` for shared repo/build/CI surfaces.

Implemented:
- Node/pnpm/Turborepo/TypeScript workspace metadata
- exact direct dependency/runtime pins
- `.editorconfig`, `.gitignore`, `.env.example`
- `packages/contracts` typed/Zod API contracts + test definitions
- `packages/config` validated runtime environment parsing + test definitions
- `apps/api` NestJS shell, `/health` endpoint + contract test
- `apps/web` Next.js shell
- hosted CI workflow
- manual-only Windows x64 self-hosted fallback workflow
- immutable commit pins for GitHub Actions
- `scripts/verify-foundation.mjs` zero-dependency repository/CI contract preflight
- `scripts/verify-foundation.test.mjs` negative regression suite for guardrail drift
- developer verification runbook

Explicitly not in Slice 1:
- PostgreSQL/migrations
- Redis/BullMQ
- hosted identity provider/auth implementation
- source connectors
- AI Agent runtime/memory implementation
- billing/payment
- Desktop/extensions
- deployment

## Verification evidence

### 1. Hosted GitHub Actions — infrastructure blocked

Hosted CI has repeatedly failed before any workflow step executes on both `ubuntu-latest` and `ubuntu-slim`.

Latest directly observed hosted failure during this continuation:
- run `33305913154`
- job `99242334397`
- head `461c7f516d7d9c49009a9064189c7331d4a4977a`
- requested label `ubuntu-slim`
- `runner_id=0`
- empty runner name
- `steps=[]`
- completed `failure` in seconds

Classification: **CI INFRASTRUCTURE / HOSTED-RUNNER ALLOCATION FAILURE — APPLICATION TESTS NOT EXECUTED**.

This is not an application-code failure and not a PASS. The exact account/org usage-budget/payment/policy/platform cause remains unverified through available repository tooling.

### 2. Runner-independent structural verification — PASS

The exact relevant files from head `baf987d8270071d17afe9ec09156735becce529b` were retrieved through the GitHub connector and reconstructed in an isolated tool-container fixture.

Executed:
- `node --check scripts/verify-foundation.mjs` — PASS
- `node --check scripts/verify-foundation.test.mjs` — PASS
- `node scripts/verify-foundation.mjs` — PASS
- `node scripts/verify-foundation.test.mjs` — PASS

Observed output:
- `Brovexa foundation preflight passed.`
- `Brovexa foundation preflight regression tests passed.`

Tool-container runtime was Node `22.16.0`, not the approved Node `24.20.0`; these scripts are zero-dependency structural guardrails, so this is useful independent structural evidence only. It does **not** verify pnpm installation, dependency resolution, Next.js/NestJS build, TypeScript 7 behavior or Vitest application tests.

### 3. CI command correctness — hardened

The explicit root gate is `pnpm run quality`:

`foundation preflight → guardrail regression suite → build → typecheck → test`

The repository intentionally does not define a root script named `ci`; bare `pnpm ci` is not used as the Brovexa quality script. Hosted/self-hosted workflows are lockfile-state aware and currently use `pnpm install --no-frozen-lockfile` only because no verified install has generated `pnpm-lock.yaml` yet.

### 4. Manual self-hosted fallback — current limitation discovered

`.github/workflows/ci-self-hosted.yml` is intentionally manual-only (`workflow_dispatch`) and targets `[self-hosted, Windows, X64]` without automatic PR/push execution.

GitHub's current official workflow-dispatch rules require a manually dispatched workflow file to exist on the repository's **default branch**. Brovexa's default branch is `main`, while this fallback currently exists only on the M01 implementation branch. Therefore it is not presently a usable manual-dispatch escape hatch without first establishing the workflow on the default branch through an approved integration path.

The connected GitHub toolset also exposes no workflow-dispatch mutation.

### 5. Harmless self-hosted runner allocation probe

A temporary same-repo PR workflow was added solely to test runner allocation:
- commit `461c7f516d7d9c49009a9064189c7331d4a4977a`
- workflow had `permissions: {}`
- matched `[self-hosted, Windows, X64]`
- did **not** checkout repository code
- would only print a fixed diagnostic message

Probe run/job:
- run `33305913219`
- job `99242334710`
- state remained `queued` during observation; no matching runner was allocated

This indicates that GitHub accepted the self-hosted job definition but a matching online/available runner was not allocated during the observation window. Exact runner inventory/status remains unverified because current connector permissions do not expose it.

The temporary probe workflow file was removed in commit `f6442d73ff8132ed90435acc0b03e7824c802b59` to prevent future automatic probe triggers. The already-created queued run may still exist; it contains no checkout/project-code execution and is harmless if GitHub later allocates it.

## Current technology pins

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `7.0.2`
- Next.js `16.3.3`
- React `19.2.8`
- NestJS `12.0.1`
- Vitest `4.1.11`
- Zod `4.5.4`

Direct dependency pins are exact. `pnpm-lock.yaml` is still absent because no approved runner/dependency installation has completed.

## M01 work packages

- `ABD-259` — executable monorepo/CI verification — IN PROGRESS / SERIALIZE
- `ABD-260` — PostgreSQL migration/data-layer harness — BLOCKED BY ABD-259
- `ABD-261` — durable worker/queue foundation — BLOCKED BY ABD-259/260
- `ABD-262` — provider-neutral identity/RBAC/tenant primitives — BLOCKED BY ABD-259/260
- `ABD-263` — API conventions/observability/health — waits for executable CI
- `ABD-264` — M01 FULL GATE/readiness handoff — final integration gate

## Known risks / not verified

- dependency install has not executed successfully
- no lockfile yet
- build/typecheck/Vitest application tests have not executed successfully
- GitHub branch/ruleset/required-check state remains NOT VERIFIED through available API
- local developer filesystem/runtime/database state remains UNKNOWN
- no DB/queue/auth primitives exist yet
- exact hosted-runner allocation failure cause remains unverified
- matching Windows x64 self-hosted runner was not allocated during the safe probe
- manual `workflow_dispatch` fallback cannot currently be used until its workflow exists on default branch

## Next safe action

1. Restore GitHub-hosted runner allocation or bring an approved `[self-hosted, Windows, X64]` runner online.
2. Establish a safe dispatchable self-hosted verification path on default branch only through an explicit integration/merge decision; do not auto-run PR code on the local machine merely to bypass the gate.
3. On an approved runner, execute Node `24.20.0`, install pnpm `11.23.0`, run the real repository preflight and dependency install.
4. Commit generated `pnpm-lock.yaml`; switch all CI installs to `pnpm install --frozen-lockfile`.
5. Execute build/typecheck/tests and fix only failures proven by logs.
6. Then add lint/format/dependency/SBOM/security gates as the next small quality slice.
7. Only after `ABD-259` has executable evidence, start `ABD-260` PostgreSQL migration/data-layer implementation.

No later milestone capability should be pulled forward to bypass this verification gate.
