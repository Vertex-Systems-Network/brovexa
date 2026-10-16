# M04 WEB-049/050 — native QA-08 and migration-compatibility checkpoint

## Exact reproducible evidence
- Native code commit under test: `50a19a836d394aec7aa6f5f367e3fb5458ce7e04`
- GitHub Actions run: https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38977813461
- Run completed SUCCESS, **4/4 jobs**: native-quality, PostgreSQL migration/RBAC, Valkey, M04 full-schema tenant/live security.
- Quality guard suite: **12/12 PASS**, including new canonical migration-0018 compatibility tests.
- PostgreSQL 18 native live-security script: **12/12 PASS**, all fixtures rolled back.
- New WEB-049 evidence cases: allowed root evidence with same-tenant observation; oversized request relative to owner grant denied; after-expiry completion denied; private IPv4 denied; immutable evidence UPDATE denied.
- The inherited WEB-048 native worker offline E2E remains green (3/3 new tests); no outbound website network in security/QA runs.

## QA gate state
- QA-01/02: previously passed pinned Node 24.20.0 / pnpm 11.23.0 native build, typecheck, Vitest; still PASS on latest code.
- QA-03/04/05: complete PG18 0000–0024 migrations UP/DOWN/reapply and identity/RBAC checks still PASS.
- QA-06: canonical Valkey queue/recovery suite still PASS.
- QA-07: offline real-M02-to-worker E2E PASS; authorized real staging-domain network E2E remains OPEN.
- QA-08: 12 native PG grant/evidence authorization checks PASS; genuine multi-connection races, long-running expiry and retention crash replay remain OPEN.
- QA-09: PR #174 migration 0018 draft diverges (lacks max_pages/max_response_bytes/timeout_ms). Compatibility guard PASS. Actual cross-branch merged-tree reconciliation remains OPEN.
- QA-10/11: final exact merged-tree CI, production configuration, staging and live deployment not performed.

## Restrictions
No changes to main, PR #174, production DB, or deployment. Guard/regression tests only; do not label M04 production-accepted.
