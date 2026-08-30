# Brovexa Project Checkpoint

Updated: 2026-08-30

## Project state

`ACTIVE_EXISTING_PROJECT`

The project transitioned from planning-only to active implementation after explicit owner approval for **M01 — Platform Foundation & Developer Experience**.

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
- current implementation head before this checkpoint update: `0b10f74f3f70a6ecab5d12a227adc2dc915ebd32`

Local developer working-copy/uncommitted/runtime/DB state remains `UNKNOWN` because canonical repository writes are being performed through remote GitHub tooling.

### VCS routing incident record

Two temporary diagnostic writes were accidentally routed during remote tooling and immediately reverted:

1. `docs/ci-command-audit.tmp` was created on `main` and immediately deleted. `49673ebd8d40133eaa00d3bd8d760ce4b372fd5a..main` compares with **zero file diff** after recovery. The create/revert commits remain in history; history was not rewritten.
2. `never-use` was created on `m01/platform-foundation` and immediately deleted. It has no net content effect. The create/revert commits remain visible rather than rewriting shared history.

Neither temporary file is implementation evidence or product scope.

## M00 state

M00 readiness/traceability/governance is complete for entering M01:
- `docs/ENGINEERING_CONSTITUTION.md` v1.2
- `docs/CAPABILITY_TRACEABILITY_MATRIX.md` v1.0
- `docs/M00_FINAL_READINESS_AUDIT.md`
- Linear `ABD-215`, `ABD-252`, `ABD-253`, `ABD-257` completed

Later vendor/legal/commercial decisions remain explicit gates for the capabilities that need them; M00 did not falsely resolve them.

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`
Parallel classification: `SERIALIZE` for shared repo/build/CI surfaces.

Implemented:
- root Node/pnpm/Turborepo/TypeScript workspace metadata
- `.editorconfig`, `.gitignore`, Node version pins and npm policy
- `packages/contracts` with typed/Zod API contracts
- `packages/config` with validated runtime environment parsing
- `apps/api` NestJS shell, `/health` endpoint and contract unit test
- `apps/web` Next.js shell
- `.github/workflows/ci.yml` hosted build/typecheck/test design
- `.github/workflows/ci-self-hosted.yml` manual-only Windows x64 fallback
- immutable commit pins for `actions/checkout` and `actions/setup-node`
- `scripts/verify-foundation.mjs` zero-dependency repository-contract preflight

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

### Hosted CI — infrastructure blocked

GitHub-hosted CI was tested with both `ubuntu-latest` and `ubuntu-slim`. Every observed attempt failed **before any workflow step executed**:
- runner not allocated (`runner_id=0`)
- runner name empty
- job step list empty
- job completed in seconds

Latest `ubuntu-slim` evidence:
- run `33304410544`
- job `99238270558`
- requested label `ubuntu-slim`
- runner `0` / empty name
- steps `[]`

Classification: `CI INFRASTRUCTURE / HOSTED-RUNNER ALLOCATION FAILURE — APPLICATION TESTS NOT EXECUTED`.

Using a second hosted runner image with the same pre-step failure makes an image-specific workflow problem less likely, but the exact account/org usage-budget/payment/policy/platform cause is still **UNVERIFIED** through available repository tooling.

This is not an application-code failure and not a PASS.

### Manual self-hosted fallback

`.github/workflows/ci-self-hosted.yml` provides a controlled fallback:
- trigger: `workflow_dispatch` only
- runner labels: `[self-hosted, Windows, X64]`
- no automatic `pull_request` or `push` execution on the self-hosted machine
- `permissions: contents: read`
- immutable Action commit pins
- same foundation preflight/install/quality contract as hosted CI

The workflow has not been dispatched/executed from this environment because the connected GitHub toolset does not expose workflow-dispatch mutation. Therefore self-hosted build/test evidence is still **NOT EXECUTED**.

### Static CI defect found and corrected

The initial workflow used a root script named `ci` and invoked `pnpm ci`. In pnpm 11, `pnpm ci` is a built-in clean-install command. That created a false-green risk because the intended build/typecheck/test script could be bypassed.

Corrective change:
- removed the ambiguous root `ci` script
- introduced explicit `quality`
- workflow now invokes `pnpm run quality`
- `quality` explicitly runs foundation preflight → build → typecheck → test

### Runner-independent structural verification

`scripts/verify-foundation.mjs` validates, without third-party packages:
- required workspace paths
- exact Node/pnpm baseline
- no root `ci` script collision
- explicit quality stages
- apps/packages workspace globs
- immutable Action SHA pins
- least-privilege `contents: read`
- explicit `pnpm run quality`
- lockfile-aware CI install mode
- hosted and self-hosted workflow invariants
- self-hosted workflow remains manual-only and explicitly Windows x64

The preflight received **local fixture PASS** using available Node execution:
- `node --check scripts/verify-foundation.mjs` — PASS
- `node scripts/verify-foundation.mjs` against a fixture representing the current foundation contract — PASS

This is partial structural evidence only. It does not verify external dependencies, NestJS/Next.js compilation, TypeScript 7 behavior or application tests.

## Current technology pins in Slice 1

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `7.0.2`
- Next.js `16.3.3`
- React `19.2.8`
- NestJS `12.0.1`
- Vitest `4.1.11`
- Zod `4.5.4`

Direct dependency pins are exact. A `pnpm-lock.yaml` is not yet committed because no dependency installation has executed successfully; frozen-lockfile CI must replace the temporary install mode immediately after the first verified install generates the lockfile.

## M01 work packages

- `ABD-259` — M01.1 executable monorepo/CI verification — IN PROGRESS / SERIALIZE
- `ABD-260` — M01.2 PostgreSQL migration/data-layer harness — BLOCKED BY ABD-259
- `ABD-261` — M01.3 durable worker/queue foundation — BLOCKED BY ABD-259/260
- `ABD-262` — M01.4 provider-neutral identity/RBAC/tenant primitives — BLOCKED BY ABD-259/260
- `ABD-263` — M01.5 API conventions/observability/health — waits for executable CI; later PARALLEL_SAFE with coordination
- `ABD-264` — M01.6 FULL GATE/readiness handoff — final integration gate

## Known risks / not verified

- dependency install/build/typecheck/test have not executed successfully yet
- no lockfile yet
- GitHub branch/ruleset/required-check state remains NOT VERIFIED through available API
- local developer filesystem/runtime/database state remains UNKNOWN
- no database/queue/auth primitives exist yet
- exact hosted-runner allocation failure cause remains unverified
- self-hosted fallback has not been dispatched/executed

## Next safe action

1. Restore hosted-runner allocation **or** manually dispatch the controlled Windows x64 self-hosted fallback when an approved runner is online.
2. Run the zero-dependency foundation preflight on the actual checked-out repository.
3. Run dependency install and generate `pnpm-lock.yaml`.
4. Commit the lockfile and switch both CI workflows to `pnpm install --frozen-lockfile`.
5. Execute actual build/typecheck/test and fix failures from real logs.
6. Add lint/format/dependency/SBOM/security gates as the next small quality slice.
7. Only after executable foundation evidence, proceed to `ABD-260` PostgreSQL migration/data-layer harness, then coordinated queue/auth work.

No later milestone capability should be pulled forward merely to bypass this verification gate.
