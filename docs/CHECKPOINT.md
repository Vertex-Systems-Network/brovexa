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
- default-branch CI bootstrap branch: `m01/ci-dispatch-bootstrap`
- default-branch CI bootstrap PR: #3, draft/unmerged
- Foundation Slice 1 initial runtime commit: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`
- implementation head immediately before this checkpoint update: `678430cb48558aea6bbd4fe0d0c303d0e0d8e097`
- PR #3 head: `70b05d951fac98a7b6a2c98847c64212dd55bee8`

Local developer working-copy/uncommitted/runtime/DB state remains `UNKNOWN` because canonical repository writes are being performed through remote GitHub tooling.

### VCS routing incident record

Two earlier temporary diagnostic writes were accidentally routed and immediately reverted without rewriting history:
- `docs/ci-command-audit.tmp` on `main`
- `never-use` on `m01/platform-foundation`

They have no net repository-content effect and are not implementation evidence.

## Default-branch protection state

GitHub branch metadata now directly verifies:

- `main protected: false`
- required status checks: off

This is no longer classified as unknown. Native branch protection remains preferred, but the current connected GitHub toolset exposes protection reads and no protection-write operation.

`docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` persists the M01 compensating controls:
- no direct feature writes to `main`
- PR-based default-branch integration
- no force push/shared-history rewrite
- no auto-merge
- expected-head verification for an explicit merge
- executable quality evidence for product/runtime PRs
- recorded exception only for narrowly scoped CI bootstrap when CI infrastructure itself is blocked
- accidental direct writes are preserved/reverted/documented rather than hidden

Linear `ABD-266` tracks this hardening state through M01 FULL GATE.

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
- branch-local manual-only Windows x64 self-hosted fallback workflow
- immutable commit pins for GitHub Actions
- `scripts/verify-foundation.mjs` zero-dependency repository/CI contract preflight
- `scripts/verify-foundation.test.mjs` negative regression suite for guardrail drift
- developer verification runbook
- default-branch integration policy

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

### 4. Branch-local self-hosted fallback limitation

`.github/workflows/ci-self-hosted.yml` is intentionally manual-only (`workflow_dispatch`) and targets `[self-hosted, Windows, X64]` without automatic PR/push execution.

GitHub's current workflow-dispatch rules require a manually dispatched workflow file to exist on the repository's **default branch**. Brovexa's default branch is `main`, while this fallback currently exists only on the M01 implementation branch. Therefore it is not presently a usable manual-dispatch escape hatch.

The connected GitHub toolset also exposes no workflow-dispatch mutation.

### 5. Harmless self-hosted runner allocation probe

A temporary same-repo PR workflow tested runner allocation only:
- commit `461c7f516d7d9c49009a9064189c7331d4a4977a`
- `permissions: {}`
- `[self-hosted, Windows, X64]`
- no repository checkout
- no project-code execution

Probe run/job:
- run `33305913219`
- job `99242334710`
- remained `queued` during observation; no matching runner was allocated

The temporary probe workflow file was removed in commit `f6442d73ff8132ed90435acc0b03e7824c802b59` to prevent future triggers. The already-created queued run may still exist; it contains no checkout/project-code execution and is harmless if allocated later.

### 6. Default-branch self-hosted dispatch bootstrap — READY AS DRAFT PR

PR #3 (`m01/ci-dispatch-bootstrap` → `main`) adds exactly one workflow:

`.github/workflows/m01-self-hosted-dispatch.yml`

Properties:
- `workflow_dispatch` only
- `contents: read`
- `[self-hosted, Windows, X64]`
- only `m01/` target refs are eligible
- immutable checkout/setup-node pins
- `persist-credentials: false`
- Node `24.20.0`
- pnpm `11.23.0`
- zero-dependency guardrails before install
- lockfile-aware dependency install
- final `pnpm run quality`
- no product/deployment/source/billing/outreach behavior

PR #3 has a recorded SELF REVIEW and is mergeable, but remains draft/unmerged with no auto-merge. Because it changes the default-branch CI surface, integration is intentionally an explicit decision.

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

- `ABD-266` — M01.0 default-branch protection/compensating controls — IN PROGRESS
- `ABD-259` — M01.1 executable monorepo/CI verification — IN PROGRESS / SERIALIZE
- `ABD-260` — M01.2 PostgreSQL migration/data-layer harness — BLOCKED BY ABD-259
- `ABD-261` — M01.3 durable worker/queue foundation — BLOCKED BY ABD-259/260
- `ABD-262` — M01.4 provider-neutral identity/RBAC/tenant primitives — BLOCKED BY ABD-259/260
- `ABD-263` — M01.5 API conventions/observability/health — waits for executable CI
- `ABD-264` — M01.6 FULL GATE/readiness handoff — final integration gate

## Known risks / not verified

- dependency install has not executed successfully
- no lockfile yet
- build/typecheck/Vitest application tests have not executed successfully
- native `main` protection is verified OFF
- local developer filesystem/runtime/database state remains UNKNOWN
- no DB/queue/auth primitives exist yet
- exact hosted-runner allocation failure cause remains unverified
- matching Windows x64 self-hosted runner was not allocated during the safe probe
- PR #3 must be explicitly integrated before its default-branch manual dispatcher can be used
- a matching self-hosted runner must be online before dispatch can actually execute

## Next safe action

1. Keep PR #3 isolated/draft until an explicit default-branch integration decision; do not auto-merge.
2. Restore GitHub-hosted runner allocation or bring an approved `[self-hosted, Windows, X64]` runner online.
3. After PR #3 is explicitly integrated to `main`, manually dispatch its workflow against `m01/platform-foundation`.
4. On the approved runner, execute Node `24.20.0`, pnpm `11.23.0`, real repository preflight and dependency install.
5. Commit generated `pnpm-lock.yaml`; switch all CI installs to `pnpm install --frozen-lockfile`.
6. Execute build/typecheck/tests and fix only failures proven by logs.
7. Then add lint/format/dependency/SBOM/security gates as the next small quality slice.
8. Only after `ABD-259` has executable evidence, start `ABD-260` PostgreSQL migration/data-layer implementation.

No later milestone capability should be pulled forward to bypass this verification gate.
