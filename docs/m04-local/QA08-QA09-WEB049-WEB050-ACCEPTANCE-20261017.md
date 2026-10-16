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

## WEB-051 — elapsed-time COMMIT authorization regression (2026-10-17)
- Exact code SHA: `d11c3bb2fcc8c69ef54a7c4f7eb459dc9f12bb2c`.
- Native GitHub Actions run: https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38981281539 — **SUCCESS, all 4/4 jobs**.
- Real PostgreSQL 18 full-schema security now **13/13 PASS** (verified in the security job log).
- New test stages a permitted same-tenant v2 receipt while its grant is valid, leaves the transaction open for 3.5 seconds after a 3-second wall-clock grant window, then forces the deferred fence. SQLSTATE `23514` / `website_live_evidence_active_grant_guard` is expected and observed.
- Uses a disposable `*_test` DB and rolls back fixtures; no external HTTP/DNS, provider credentials, production DB or deployment.
- QA-08 has one additional real-time expiry acceptance case. Multi-connection revoke/COMMIT races, crash/restart retention replay and authorized live staging remain OPEN.
- QA-09 cross-branch `0018` reconciliation and final PR/main full-gate integration remain OPEN. This is a branch QA checkpoint, **not release acceptance**.
