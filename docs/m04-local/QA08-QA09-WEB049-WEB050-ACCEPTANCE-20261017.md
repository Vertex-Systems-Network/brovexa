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

## WEB-056/057 — genuine two-connection owner revocation / COMMIT interleavings (2026-10-17)
- WEB-056 tested code SHA `03a1ba5e9576db9f1593c649bd871e7c4294491b`: [native CI #38988455926](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38988455926) **SUCCESS 4/4; PG18 22/22 PASS**.
- WEB-057 tested code SHA `55504949ca9418fc05141c73c219b4d6a3423c54`: [native CI #38988548926](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38988548926) **SUCCESS 4/4; PG18 23/23 PASS** (confirmed from security-job logs).
- **Revocation wins:** grant/evidence are inserted into an uncommitted transaction with deferred authorization; a second real PG connection suspends the approving owner, then the writer forces the deferred fence. SQLSTATE 23514 is required; the pending grant and evidence are rolled back, with no unauthorized record committed.
- **Fence wins:** a previously committed valid grant receives evidence inside a still-open writer transaction. Deferred authorization is forced and obtains row-level `FOR SHARE` locks. A second PG connection tries to suspend the approving owner with bounded 350-ms lock timeout; SQLSTATE `55P03` proves the revoker must wait until writer COMMIT. The authorized evidence row persists.
- To honor identity/RBAC's last-active-owner guard, the isolated QA workspace first grants owner role to an already-active secondary member. This is a valid second owner, **not** a bypass of the identity constraint. The primary owner membership is restored after the revocation-wins test.
- Tests use disposable PG18 `*_test` DB, no website HTTP/DNS, credentials, production data or release. The committed WEB-055/057 source registry/evidence fixtures remain only in the isolated database; native CI disposes of the service when jobs finish.
- **QA-08 status:** verified nonzero process-exit-after-COMMIT replay and both owner revocation/evidence COMMIT orderings. More complex independent source-registry or domain revocation transitions and actual server crash recovery are not demonstrated. Authorized staging, migration PR #174 compatibility, protected integration tree and deployment gates remain OPEN.

## WEB-058 — current connector review deadline at deferred authorization (2026-10-17)
- Exact tested source commit: `367128332e1f02ae2c3e9e151ac7fa474d0c16b0`.
- [Native CI #39024046317](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39024046317): **SUCCESS 4/4** (pinned Node24/pnpm11 build/typecheck/Vitest, PG18 migration and identity, Valkey, M04 full-schema security).
- Real PostgreSQL 18 M04 security now **25/25 PASS**, confirmed in security-job logs.
- WEB-058 adds a fresh, immutable, initially APPROVED M02 connector policy with a two-second review deadline, an enabled connector definition and scoped allow admission. Both fixtures are inserted under rollback-safe savepoints; there is no policy-row mutation or authorization bypass.
- **Grant expiry order:** an approved grant is staged while the connector policy's review deadline is current. The transaction remains open for 2.5 seconds. Its deferred grant fence rejects with SQLSTATE `23514`, `website_live_registry_current_guard`.
- **Evidence expiry order:** the grant passes while the same current policy is valid. Live evidence is staged and the review window elapses before the evidence deferred fence. Again SQLSTATE `23514`, `website_live_registry_current_guard` rejects. This proves a previously allowed admission snapshot does not replace current policy review validity at COMMIT.
- PostgreSQL `clock_timestamp()` is used for the real elapsed deadline; no mocked time, external domain requests, production services or schema edits. All new expiry fixtures roll back after each scenario.
- **Still OPEN:** source-registry revision supersession and newer conflicting domain-verification decisions are distinct from a policy review window expiring. The current 0020/0021/0023 triggers join the original verified domain decision by ID, not an explicitly latest-decision query. A latest non-verified decision supersession must be independently tested and reconciled through an authorized forward migration if it proves a gap. Do not claim this is protected by the WEB-058 tests.
- QA-09 incompatible migration 0018 in PR #174, staging network authorization, final protected merged-tree verification and release/deployment remain OPEN.

## WEB-059 — latest domain-verification decision and concurrent COMMIT serialization (2026-10-17)
- Exact source SHA tested: `1e58fc0f095cf04892d7b87a4e69dac847e837c6`; [Native CI #39026164817](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39026164817) **SUCCESS all 4/4 jobs**.
- **PG18 full-schema security 30/30 PASS** (verified from security-job logs). Node24/pnpm11 quality, PostgreSQL18 full migration UP/DOWN/reapply and identity/RBAC, and Valkey all succeeded at the same SHA.
- Reserved **0025** on the isolated M04 checkpoint's migration ledger and implemented `0025_website_live_current_domain_decision_guard` with matching DOWN. Earlier migration 0015/0016, and live migrations 0020-0024, were not rewritten. Reservation state is `IMPLEMENTED`, **not integrated or globally released**; final serialized reconciliation with DATABASE slot/PR #174 remains required.
- Forward migration adds a domain-key transaction advisory lock on each new append-only domain-verification decision INSERT, and deferred transaction-scoped authorization guards on live grant and evidence INSERT. Grant/evidence COMMIT checks the **latest** same-workspace/business/domain decision by `evaluated_at DESC,created_at DESC,id DESC` and rejects unless it is the **exact previously approved verified decision ID**.
- Guard accepts only `READ COMMITTED` writers for reliable fresh snapshot semantics; stronger transaction snapshot isolation fails closed rather than accepting an invisible concurrent domain revision.
- New native adversarial coverage: (1) a newer rejected decision invalidates an older verified grant; (2) a newer rejected decision invalidates evidence from an earlier approved grant; (3) even newer VERIFIED revisions require a fresh owner-approved grant, preventing stale-ID reuse; (4) if the evidence authorization fence acquires the domain lock first, the conflicting new decision's separate PG connection waits and receives bounded SQLSTATE `55P03`; (5) if a different connection first COMMITs a newer rejected decision, the pending grant/evidence transaction fails with SQLSTATE `23514` / `website_live_current_domain_decision_guard`.
- Test fixtures are confined to isolated localhost `*_test` PG18 CI services; no real DNS/HTTP, credentials, production DB, mutation of PR #174, `main` merge or deploy.
- **Remaining:** newer connector-registry revision semantics beyond policy review expiry, migration 0018 integration divergence with PR #174, actual applied database ledger audit, authorized staging domain E2E, full exact merged-tree gates, and production/deployment approval. Source-level WEB-059 acceptance is **not release acceptance**.

## WEB-060 — append-only connector registry revision supersession and COMMIT races (2026-10-17)
- Exact tested code SHA: `6821161f5294d7855d4c01adedc8a2f997adfc27`.
- [Native CI #39039079620](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39039079620): **SUCCESS 4/4** — Node24/pnpm11 quality/typecheck/Vitest, PostgreSQL18 0000–0026 UP/DOWN/reapply and RBAC, Valkey and native full-schema M04 security.
- **35/35 native PG18 security scenarios PASS**, confirmed from security job logs.
- Reserved and implemented isolated **0026** `website_live_current_connector_revision_guard` with matching reversible DOWN; `.agent/migrations.yaml` on the checkpoint advances `next_unreserved_number` to `0027`. This is not yet integrated migration ownership/approval across agent branches.
- The append-only connector definition INSERT locks by source+connector identity, while deferred live grant and evidence COMMIT fences use the same advisory transaction lock. With a fresh `READ COMMITTED` snapshot, the guard requires the current connector definition to be the exact ID pinned to the allowed admission and still `approved/enabled`. Later disabled or even reapproved connector revisions require a fresh admission/owner grant rather than silently reusing stale approval.
- Native PG18 verifies (1) newer disabled version invalidates a prior grant, (2) newer enabled version still requires refreshed admission, (3) newer disabled version invalidates evidence with previously valid grant, (4) evidence COMMIT fence wins and concurrent revision INSERT receives bounded `55P03` lock timeout, and (5) committed newer disabled version wins and pending grant/evidence fail with `23514`, `website_live_current_connector_revision_guard`.
- The independently blocked policy fixture was scoped to a separate connector key, so it cannot itself supersede the baseline connector as a test side effect. Concurrency races use workspace B and its valid verified domain, avoiding workspace A's earlier deliberate domain revocation. The first CI attempt failed after 28 passes due to that fixture interference; the repaired run above is fully green.
- Source registry remains immutable; no direct UPDATE, DELETE or trigger bypass. All transactional/committed test rows are limited to disposable localhost `*_test` PG18 services; no real network/domain lookup, production credentials, main merge, PR #174 mutation, or deployment.
- **Still OPEN:** candidate merged-tree reconciliation with incompatible PR #174 migration `0018`, actual applied DB history, serialized migration 0025/0026 ownership, authorized staging domain and final protected exact-head/main gates. Native checkpoint green does **not** imply integrated/released module.

## WEB-061 — QA-09 applied migration 0018 provenance verification (2026-10-17)
- Exact tested source `c0d0d86121083464110882266684c02a83c7e55f`; [native CI #39044533719](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39044533719) **SUCCESS 4/4** with 35/35 M04 live PG18 security unchanged.
- Read-only QA-09 migration provenance query on the **disposable CI database only** returned `CANONICAL_APPLIED`, applied/local SHA256 both `7d2779e5dc2ad78de358ca013edf15af20165715ff326fb5c5cbefa4dfc82e67`, no missing or invalid type/NOT NULL/CHECK definitions.
- New **16/16** pure regressions prove that applied PR-style divergent SQL fingerprints, unknown checksums, missing/duplicate/misordered migration entries, missing budget columns and invalid metadata fail closed. The exact draft PR #174 applied journal was **not** inspected.
- Audit is mandatory in native checkpoint workflow after real full-schema PG18 security. No mutation, rechecksum, network acquisition or staging/production access. QA-09 source-branch 0018 divergence, serialized migration integration, protected merged tree and staging remain OPEN. Detailed evidence: [QA-09 reconciliation](QA09-PR174-RECONCILIATION-20261017.md).

## WEB-062 — real draft PR #174 0018 negative migration-history gate (2026-10-17)
- [M04 native CI #39049593367](https://github.com/Vertex-Systems-Network/brovexa/actions/runs/39049593367) **5/5 SUCCESS** at exact source SHA `cf1883596ce1414803ebba5042974ba2b84ebc1b`. Existing full-schema PG18 security remains **35/35 PASS** and the canonical 0018 read-only audit remains `CANONICAL_APPLIED` on the separate disposable live QA DB.
- `scripts/fixtures/m04-pr174-0018.up.sql` pins the **exact untouched** draft PR #174 Git blob `41696665e6422b3a161476fbb3f5b1f5f17ec149`; `scripts/verify-m04-pr174-divergence.mjs` independently checks that blob before proceeding.
- A **fifth independent** real PG18 service applies 0000–0018 using the draft SQL. Its journal has alternate SHA256 `877b161f7e95f58feb3ef00941721bf76488b546e50a8ab7d7da723a9fc17b12`, while the checkpoint expects canonical `7d2779e5dc2ad78de358ca013edf15af20165715ff326fb5c5cbefa4dfc82e67`.
- Proven `KNOWN_DIVERGENT_APPLIED`, matching real `applyPendingMigrations` checksum mismatch, **zero changes to all applied journal rows**, and **no accidental 0019+ migration applications**. The test never disables database checks or repurposes real staging/production, and exercises both original migration engines/SQL lineages without rewriting the canonical file.
- Native workflow-governance tests require 5 pinned jobs, 4 PostgreSQL service environments, the Valkey service, loopback-only `*_test` URLs, QA opt-in flags, and the exact negative-test entrypoint. Their obsolete four-job expectation was corrected after CI caught the drift.
- **OPEN for QA-09:** database integration owner must reconcile source branch PR #174 and target applied checksum with canonical 0018 / adapter, or preserve the draft 0018 checksum and add a properly reserved forward compatibility migration; reconcile isolated 0025/0026, run exact combined-tree gates and authorized staging E2E. Tested alternate database is disposable and does not reveal any production/staging applied history.
