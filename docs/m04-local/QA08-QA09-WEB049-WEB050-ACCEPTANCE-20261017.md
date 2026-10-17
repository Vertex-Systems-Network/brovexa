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

## WEB-052 — real PostgreSQL concurrent retention idempotency (2026-10-17)
- Exact verified source SHA: `8426ba1eef6ccd64ecb54fa3ef83408208d5b23c`.
- Native GitHub Actions run: https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38981650821 — **SUCCESS 4/4 jobs**.
- Native PG18 M04 live security expanded to **14/14 PASS**, confirmed from the security job log.
- Two concurrent real PG pool connections attempted identical retention work IDs against a disposable, visible test tenant. One fresh transaction persisted one immutable receipt; the other replayed the same zero-row effect. Exactly one scoped receipt remained; test tenant/receipt were deleted by cascading cleanup.
- This verifies two-connection zero-row deduplication, **not** active multi-connection owner/registry revocation or actual crash-after-COMMIT recovery. Those extended QA-08 checks stay OPEN.
- No real site requests, tenant production data, PR #174 changes, `main` merges, or deployments.

## WEB-053 — native persisted replay scope checks (2026-10-17)
- Exact tested code SHA: `8f8b6a72bf02d258b11337e6dc890568fbb7d997`.
- [Native CI #38985135657](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38985135657): **4/4 SUCCESS** (quality/typecheck/Vitest, PostgreSQL 18 migration+identity, Valkey, M04 full-schema).
- Native PostgreSQL 18 M04 security: **17/17 PASS** confirmed in the security job logs.
- A real committed zero-row maintenance receipt was reloaded after a simulated lost acknowledgement, replayed with the same work ID and workspace without executing a second delete.
- Changed max-row budget for a committed work ID failed with `M04_LIVE_DB_ID_CONFLICT`; different workspace reuse of the same work ID also failed, without creating a foreign receipt.
- Two-connection same-work-ID replay remains covered by WEB-052. Test-created workspaces and receipts are cleaned up. No live external network or production operations.
- **Scope warning:** This tests durable receipt replay of a zero-row maintenance work unit, **not** actual process termination after a nonzero cleanup COMMIT. Actual crash/restart with deleted evidence and owner/registry revocation races remain unverified release gates.

## WEB-054 — globally serialized work IDs and cross-tenant race (2026-10-17)
- Verified code SHA: `c92a1d660e9691982321c1593c3f28dfdfc1ea85`.
- [GitHub native checkpoint run #38986347230](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38986347230): **SUCCESS 4/4** (Node24/pnpm11 native quality, PostgreSQL18 migrations/RBAC, Valkey, full-schema M04 security).
- **Native PG18 security 18/18 PASS**, including simultaneous real PostgreSQL connections making the same globally unique retention work-ID claim from different workspaces; one claim COMMITs, the other fails with a bounded `M04_LIVE_DB_ID_CONFLICT` instead of a raw primary-key race. Exactly one persisted receipt remains.
- `packages/db/src/website-live-persistence.ts` now locks by canonical `workUnitId` alone to match migration 0022's global `work_unit_id` primary key, while independently comparing workspace and budget against the durable receipt.
- Native Vitest regression asserts the advisory lock argument is identical for the same work ID across different workspaces. The PostgreSQL test's disposable workspaces and their receipts are removed afterward.
- **Still OPEN:** nonzero retained-evidence deletion followed by actual process termination/restart, concurrent owner/registry revocation during live write COMMIT, authorized real-network staging E2E, QA-09 migration 0018/PR #174 reconciliation and final protected merged-tree gates. None of these are proven by the 18/18 count.
- No changes to protected `main`, PR #174, production database, external acquisition or deployment.

## WEB-055 — durable nonzero retention replay after separate process terminates (2026-10-17)
- Exact code SHA under verification: `2fc8684781c675a2cf6f989b9978974b5f6a0439`.
- [Native GitHub Actions #38988165072](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38988165072): **SUCCESS 4/4** — native TypeScript/Vitest, PG18 full UP/DOWN/reapply and identity, Valkey, and M04 full-schema security.
- **PG18 live security 21/21 PASS** (security-job logs). New checks use real committed, owner-approved evidence for two 1-second-TTL records plus one nonexpired record and associated child observations.
- The first dedicated Node process purges one expired record using a bounded `maxRows=1` call, then deliberately exits with status 37 **after PostgreSQL COMMIT and before producing an acknowledgement**. The parent independently reads a durable receipt with `deleted_count=1` and sees exactly one expired row still present.
- A **new process with a new connection pool** repeats the same work ID and receives `{deleted:1,replayed:true}` without consuming the remaining expired evidence. A subsequent fresh work ID deletes the remaining expired evidence. A live nonexpired record and its single child observation remain; expired child rows cascade away.
- Source capabilities, policies and admission snapshots are append-only by schema. The committed WEB-055 fixture remains only in the guarded, dedicated `*_test` database; GitHub CI tears down the entire disposable PostgreSQL container after the job. No delete-trigger bypass, provider credentials, outbound network, production database, `main`, PR #174 mutation or deployment.
- This is a **controlled lost-ack / process-exit-after-COMMIT simulation** across actual OS processes and real PG18 transactions. It does not simulate OS-level SIGKILL mid-transaction, PostgreSQL server crash/disk recovery, active owner/registry revocation interleavings, or external authorized staging transport.
- **QA-08 progress:** nonzero post-COMMIT process redelivery acceptance **PASS**; concurrent authorization revocation remains OPEN. QA-09, QA-10, QA-11 and live staging remain OPEN.
