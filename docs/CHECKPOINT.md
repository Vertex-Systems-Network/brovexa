# Brovexa Project Checkpoint

Updated: 2026-08-30

## Project state

`ACTIVE_EXISTING_PROJECT`

Brovexa moved from planning-only to active implementation after explicit owner approval for **M01 — Platform Foundation & Developer Experience**.

## Authorization

Approved scope: **M01 milestone**. Later production connectors, payments, unrestricted acquisition, autonomous outreach, Market Scout activation, production deployment and destructive actions remain separately gated.

## VCS state

- default branch: `main`
- planning PR: #1, draft/unmerged
- implementation branch: `m01/platform-foundation`
- implementation PR: #2, draft/unmerged
- default-branch self-hosted dispatcher merge: `eed4cbd16e987e254bd2b9758afb1817e3b60ceb`
- Foundation Slice 1 initial runtime: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`
- shared-package production-build hardening: `43f8deccd50d74c0591586926d6047144fdc2580`
- no-rewrite sibling reconciliation: `56c8844e1e891c29977ba74026103b7159746ee6`
- structural-verification checkpoint: `b2165889b63f8e07abcc6af8cbdcc53ec7796015`

Local developer working-copy/runtime/DB state remains `UNKNOWN` because repository work is being performed through remote GitHub tooling.

## Default-branch protection

`main` is verified unprotected with required checks off. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the compensating control and Linear `ABD-266` stays open through M01 FULL GATE.

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`.

Implemented foundation includes monorepo metadata, exact runtime/dependency pins, contracts/config packages, Nest `/health`, Next Web shell, hosted CI, manual self-hosted verification path, immutable Action pins, structural verifier/regression suite, runbook and default-branch integration policy.

### Static hardening findings resolved

1. **Shared test emission** — config/contracts production builds now use dedicated build tsconfigs excluding `*.spec.ts`/`*.test.ts`, while full tsconfigs retain test typechecking.
2. **TypeScript 7 module-resolution incompatibility** — API/config/contracts previously used `moduleResolution: "Node"` (legacy node10). TypeScript 7 removes that mode. Node-targeted projects now use `module: "NodeNext"` and `moduleResolution: "NodeNext"`. No package `type: module` was introduced, so current CommonJS application semantics are preserved while modern Node/package-export resolution is modeled.
3. Foundation guardrails now enforce both corrections and contain negative regression cases.

Official compatibility basis reviewed during this hardening:
- TypeScript 7 removes legacy `node/node10` module resolution and recommends NodeNext/bundler as appropriate.
- NestJS 12 core packages are ESM but explicitly support CommonJS applications on modern Node via `require(esm)`; migration of application code to ESM is optional.

## Verification evidence

### Hosted GitHub Actions — infrastructure blocked

Latest hosted run on prior checkpoint head `b2165889b63f8e07abcc6af8cbdcc53ec7796015`:
- run `33307366554`
- job `99246165648`
- conclusion `failure`
- no executable steps returned

Classification remains `CI INFRASTRUCTURE / HOSTED-RUNNER ALLOCATION FAILURE — APPLICATION TESTS NOT EXECUTED`.

### Runner-independent structural verification

Structural guardrails passed on the previous reconciled surface. The new NodeNext guardrail/fix is source-reviewed and must be re-executed against the new exact head after this commit. This is not a Node 24/package build PASS claim.

### Default-branch manual dispatcher

`.github/workflows/m01-self-hosted-dispatch.yml` is present on `main` and ready for manual use on an approved `[self-hosted, Windows, X64]` runner. No approved runner execution has yet been verified.

## Technology pins

- Node.js `24.20.0`
- pnpm `11.23.0`
- TypeScript `7.0.2`
- Next.js `16.3.3`
- React `19.2.8`
- NestJS `12.0.1`
- Vitest `4.1.11`
- Zod `4.5.4`

`pnpm-lock.yaml` remains absent because no approved dependency install has completed.

## M01 gates

- `ABD-266` — default-branch protection/compensating controls — IN PROGRESS
- `ABD-259` — executable monorepo/CI verification — IN PROGRESS / SERIALIZE
- `ABD-260` — PostgreSQL harness — BLOCKED BY ABD-259
- `ABD-261` — durable worker/queue — BLOCKED BY ABD-259/260
- `ABD-262` — identity/RBAC/tenant — BLOCKED BY ABD-259/260
- `ABD-263` — API/observability/health — waits for executable CI
- `ABD-264` — M01 FULL GATE — final integration gate

## Still not verified

- approved Node 24 dependency install
- lockfile generation/frozen-lockfile mode
- Next/Nest build
- TypeScript 7 actual compiler execution
- Vitest application tests
- native main protection
- local developer runtime/database state
- approved Windows self-hosted quality run

## Next safe action

1. Advance branch to this NodeNext compatibility hardening commit.
2. Re-run zero-dependency structural verifier/regression suite on the exact new head.
3. If hosted allocation recovers or approved Windows runner is online, execute the real Node 24/pnpm quality path.
4. Generate/commit `pnpm-lock.yaml`, switch installs to frozen mode, then obtain actual build/typecheck/Vitest evidence.
5. Only after `ABD-259` passes may `ABD-260` PostgreSQL implementation begin.
