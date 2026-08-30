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

- default branch: `main` at original implementation baseline
- planning branch: `planning/brovexa-baseline`
- planning PR: #1, draft/unmerged
- implementation branch: `m01/platform-foundation`
- implementation PR: #2, draft/unmerged
- Foundation Slice 1 initial runtime commit: `9cc48faed8531cbab1a72716e5f9b5c351f6902c`

Local developer working-copy/uncommitted/runtime/DB state remains `UNKNOWN` because this implementation is being performed through remote GitHub tooling.

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
- `.github/workflows/ci.yml` executable build/typecheck/test gate

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

Initial CI runs for `9cc48faed8531cbab1a72716e5f9b5c351f6902c` failed **before any job step executed**:
- runner was not allocated (`runner_id=0`)
- job returned zero steps
- decoded job log artifact was unavailable

Classification: `CI INFRASTRUCTURE FAILURE / APPLICATION TESTS NOT EXECUTED`.

This is not a code/test failure and not a PASS. GitHub-hosted runner/billing/platform state cannot be fully diagnosed through the current repository connector. Recent public GitHub reports also show this same runner-id-zero/no-step signature can originate outside workflow code, so no speculative code changes are justified without runner execution evidence.

The workflow was narrowed to PR/manual triggers to avoid duplicate push+PR runs. It continues to use least-privilege `contents: read`.

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

## Known risks / not verified

- dependency install/build/typecheck/test have not executed successfully yet
- no lockfile yet
- GitHub branch/ruleset/required-check state remains NOT VERIFIED through available API
- local filesystem/runtime/database state remains UNKNOWN
- no database/queue/auth primitives exist yet

## Next safe action

1. Obtain an executable CI runner and run Foundation Slice 1 quality gate.
2. Fix any real build/type/test failures from logs.
3. Generate/commit `pnpm-lock.yaml` and change CI to `--frozen-lockfile`.
4. Add lint/format/security dependency checks as the next small M01 quality slice.
5. Only after executable foundation evidence, proceed to PostgreSQL migration/data-layer harness, then durable worker/queue primitives and provider-neutral auth/RBAC/tenant primitives.

No later milestone capability should be pulled forward merely to bypass this verification gate.
