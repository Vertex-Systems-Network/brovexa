# Brovexa M04 — checkpoint-only native acceptance wiring

## Scope
- Added a checkpoint-only `.github/workflows/m04-native-checkpoint.yml` workflow for branch `checkpoint/m04-local-web006-20261016` with manual `workflow_dispatch` option.
- No changes to `main`, database PR #174, production app configuration, secrets, or deployment.
- Three independent jobs with GitHub-hosted ephemeral runners:
  1. `native-quality`: Node 24.20.0, pnpm 11.23.0, frozen monorepo install, full `quality:runtime` (build/typecheck/Vitest), static QA guard tests.
  2. `native-postgres`: isolated PostgreSQL 18.6 service on `127.0.0.1`, `verify-m04-qa.mjs --preflight`, `verify:db`, `verify:identity`.
  3. `native-valkey`: isolated PG18.6 + Valkey9.1.1 service, `verify:queue`.
- Exact version and container digests reused from existing repository CI.
- Added `scripts/verify-m04-workflow-guard.test.mjs`: three offline safety checks PASS on Node 22.

## Interpretation
- A workflow definition being committed is NOT a native QA pass. Check real GitHub Actions job statuses/logs before closing QA-01, QA-02, QA-05, QA-06.
- Prior evidence: full-base PG18 migration 0000–0024 UP 25/25 PASS; targeted-fixture 0018–0024 DOWN 7/7 PASS; 350/350 offline regression tests PASS; three isolated TS checks PASS.
- Full-base DOWN/UP and full-base domain/RBAC scenario completion remain open.
- If repo GitHub Actions is disabled or runner capacity unavailable, the native jobs may remain pending without proving any code failure.

## Safety
- Checkout uses `persist-credentials: false` and only `contents: read` permissions.
- DB reset opt-in is confined to each service container; databases must match `brovexa_m04_qa_*_test` and localhost guard.
- No network acquisition of live third-party websites in QA jobs; queue service uses local Valkey.