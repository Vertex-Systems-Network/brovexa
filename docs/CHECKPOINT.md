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
- TypeScript 7 NodeNext compatibility hardening: `5e7318a87db2ddd57928dd0ddf364dfb8ecdc016`
- API local `.env` loading fix: `8c939b90f874dfc5f68afba1c64faae450ffd584`
- self-hosted dispatcher hardening branch: `m01/self-hosted-dispatch-hardening`
- self-hosted dispatcher hardening PR: #5, draft/unmerged, head `d409c19d56e9da502d25d9846f405b6ec44bfc35`

Local developer working-copy/runtime/DB state remains `UNKNOWN` because repository work is being performed through remote GitHub tooling.

## Default-branch protection

`main` is verified unprotected with required checks off. `docs/DEFAULT_BRANCH_INTEGRATION_POLICY.md` remains the compensating control and Linear `ABD-266` stays open through M01 FULL GATE.

PR #5 is an additional least-privilege correction to the default-branch self-hosted dispatcher. It changes exactly one workflow file, is SELF REVIEWED and currently mergeable, but remains draft/unmerged/no-auto-merge until an explicit default-branch integration decision.

## M01 Foundation Slice 1

State: `IMPLEMENTED BUT NOT VERIFIED`.

Implemented foundation includes monorepo metadata, exact runtime/dependency pins, contracts/config packages, Nest `/health`, Next Web shell, hosted CI, manual self-hosted verification path, immutable Action pins, structural verifier/regression suite, runbook and default-branch integration policy.

### Static hardening findings resolved

1. **Shared test emission** — config/contracts production builds use dedicated build tsconfigs excluding `*.spec.ts`/`*.test.ts`, while full tsconfigs retain test typechecking.
2. **TypeScript 7 module-resolution incompatibility** — API/config/contracts previously used legacy `moduleResolution: "Node"`; Node-targeted projects now use `module: "NodeNext"` and `moduleResolution: "NodeNext"`.
3. **Guardrail drift prevention** — the zero-dependency verifier enforces production-build separation and modern NodeNext resolution with negative regression coverage.
4. **Local environment mismatch** — the runbook instructed developers to copy `.env.example` to repo-root `.env`, while API scripts did not load that file. API `dev`/`start` now use Node 24 native `--env-file-if-exists=../../.env`. Real process environment variables continue to take precedence over file values.
5. **Self-hosted ref overbreadth** — the merged default-branch dispatcher accepts arbitrary caller-supplied `m01/*` refs. Draft PR #5 removes that input and fixes checkout to `m01/platform-foundation`; integration remains pending explicit approval.

No package `type: module` was introduced, so current application files remain CommonJS under NodeNext while modern Node/package-export resolution is modeled.

## Verification evidence

### Hosted GitHub Actions — infrastructure blocked

Latest hosted run on current API-env head `8c939b90f874dfc5f68afba1c64faae450ffd584`:
- run `33308458435`
- job `99249082465`
- conclusion `failure`
- no executable steps returned

Classification remains `CI INFRASTRUCTURE / HOSTED-RUNNER ALLOCATION FAILURE — APPLICATION TESTS NOT EXECUTED`.

### Runner-independent structural verification — PASS within scope

The zero-dependency foundation verifier/regression suite has been independently exercised against retrieved repository invariants. Positive foundation cases PASS and negative cases fail as expected for dependency-version drift, mutable Action tags, unsafe self-hosted auto-triggering, test-inclusive production builds and legacy TypeScript Node resolution.

Available tool-container Node is 22.x, so this is structural evidence only. It is **not** approved Node 24 dependency-install, TypeScript 7 compiler, Next/Nest build or Vitest execution evidence.

### Default-branch manual dispatcher

`.github/workflows/m01-self-hosted-dispatch.yml` is present on `main`. The currently merged form is manual-only, `contents: read`, targets `[self-hosted, Windows, X64]`, uses immutable Action pins and disables persisted checkout credentials.

Before relying on it as the preferred trusted-runner path, PR #5 should be explicitly integrated so the dispatcher can execute only `m01/platform-foundation` rather than arbitrary `m01/*` refs.

No approved Windows self-hosted quality execution has been verified yet.

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

1. Obtain explicit default-branch integration approval for reviewed/mergeable draft PR #5; merge only against expected head `d409c19d56e9da502d25d9846f405b6ec44bfc35`.
2. Bring an approved `[self-hosted, Windows, X64]` runner online and manually execute the default-branch dispatcher against the fixed `m01/platform-foundation` branch, or use GitHub-hosted CI if allocation recovers.
3. Execute Node `24.20.0` + pnpm `11.23.0` dependency installation.
4. Commit generated `pnpm-lock.yaml` and switch all CI installs to `pnpm install --frozen-lockfile`.
5. Run build/typecheck/Vitest and fix only failures proven by logs.
6. Then add lint/format/dependency/SBOM/security gates.
7. Only after `ABD-259` passes may `ABD-260` PostgreSQL implementation begin.

No later milestone capability should be pulled forward to bypass this verification gate.
