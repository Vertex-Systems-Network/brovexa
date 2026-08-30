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
- default-branch self-hosted dispatcher is merged on `main`
- default-branch dispatcher merge commit: `eed4cbd16e987e254bd2b9758afb1817e3b60ceb`
- Foundation Slice 1 initial runtime commit: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`
- shared-package build hardening: `43f8deccd50d74c0591586926d6047144fdc2580`
- checkpoint sibling: `347eedffa1fbaccadc2c3d3d4f314d9ac88f9ebf`
- no-rewrite reconciliation merge: `56c8844e1e891c29977ba74026103b7159746ee6`

The sibling commits were reconciled with a two-parent merge and branch fast-forward. No force push/history rewrite was used.

Local developer working-copy/uncommitted/runtime/DB state remains `UNKNOWN` because canonical repository writes are being performed through remote GitHub tooling.

## Default-branch protection state

GitHub branch metadata verifies:
- `main protected: false`
- required status checks: off

`docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` is the current compensating control. Linear `ABD-266` remains open through M01 FULL GATE.

## M00 state

M00 readiness/governance is complete for entering M01. Later vendor/legal/commercial decisions remain explicit gates for the capabilities that require them.

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`
Parallel classification: `SERIALIZE` for shared repo/build/CI surfaces.

Implemented:
- Node/pnpm/Turborepo/TypeScript workspace metadata
- exact direct dependency/runtime pins
- `.editorconfig`, `.gitignore`, `.env.example`
- `packages/contracts` typed/Zod API contracts + tests
- `packages/config` validated runtime environment parsing + tests
- `apps/api` NestJS shell, `/health` endpoint + contract test
- `apps/web` Next.js shell
- hosted CI workflow
- manual Windows x64 self-hosted verification designs
- immutable commit pins for GitHub Actions
- zero-dependency foundation verifier + regression suite
- developer verification runbook
- default-branch integration policy

Latest static review hardening:
- shared package production builds use separate `tsconfig.build.json`
- `*.spec.ts` and `*.test.ts` are excluded from emitted production `dist`
- normal `tsconfig.json` remains the full source/test typecheck surface
- foundation verifier enforces build/test separation
- regression suite fails if a shared package build drifts back to the full test-inclusive tsconfig

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

### Hosted GitHub Actions — infrastructure blocked

Latest run for reconciliation head `56c8844e1e891c29977ba74026103b7159746ee6`:
- run `33307179139`
- job `99245665723`
- conclusion `failure`
- no executable steps returned

This matches the established pre-runner infrastructure-failure pattern. No application build/typecheck/Vitest PASS exists.

### Runner-independent structural verification — PASS

For head `56c8844e1e891c29977ba74026103b7159746ee6`, the exact structural manifests/configs/workflows/verifier scripts were retrieved from GitHub and reconstructed in an isolated tool fixture. Spec files were represented only for their existence checks; their executable tests are not claimed by this structural run.

Executed with available tool-container Node `22.16.0`:
- `node --check scripts/verify-foundation.mjs` — PASS
- `node --check scripts/verify-foundation.test.mjs` — PASS
- `node scripts/verify-foundation.mjs` — PASS
- `node scripts/verify-foundation.test.mjs` — PASS

Observed output:
- `Brovexa foundation preflight passed.`
- `Brovexa foundation preflight regression tests passed.`

This validates repository/CI guardrails including the new shared-package build/test separation. It does **not** verify approved Node `24.20.0`, dependency resolution, Next/Nest compilation, TypeScript 7, or Vitest application tests.

### Default-branch manual dispatcher

`.github/workflows/m01-self-hosted-dispatch.yml` is on `main`, manual-only, `contents: read`, targets `[self-hosted, Windows, X64]`, restricts target refs to `m01/*`, uses immutable Action pins, disables persisted checkout credentials, and runs the explicit `pnpm run quality` gate.

Workflow presence is not execution evidence. No matching approved runner execution has been verified yet.

## Current technology pins

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `7.0.2`
- Next.js `16.3.3`
- React `19.2.8`
- NestJS `12.0.1`
- Vitest `4.1.11`
- Zod `4.5.4`

`pnpm-lock.yaml` is still absent because no approved dependency installation has completed.

## M01 work packages

- `ABD-266` — default-branch protection/compensating controls — IN PROGRESS
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
- native `main` protection remains OFF
- local developer filesystem/runtime/database state remains UNKNOWN
- exact hosted-runner allocation failure cause remains unverified
- approved Windows x64 self-hosted quality run has not executed

## Next safe action

1. Use GitHub-hosted CI if runner allocation recovers, or manually dispatch the default-branch self-hosted verifier when an approved Windows x64 runner is online.
2. Execute Node `24.20.0` + pnpm `11.23.0` dependency install.
3. Commit generated `pnpm-lock.yaml` and switch all CI installs to `pnpm install --frozen-lockfile`.
4. Execute build/typecheck/Vitest and fix only log-proven failures.
5. Then add lint/format/dependency/SBOM/security gates.
6. Only after `ABD-259` has executable evidence, start `ABD-260` PostgreSQL migration/data-layer implementation.

No later milestone capability should be pulled forward to bypass this verification gate.
