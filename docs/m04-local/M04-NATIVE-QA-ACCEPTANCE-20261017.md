# Brovexa M04 — Native QA Acceptance Checkpoint

**Verified development source SHA:** `9b97e955057b453ee7e751d48de53f055e26bda1`  
**Workflow:** https://github.com/Vertex-Systems-Network/brovexa/actions/runs/38957132035  
**Conclusion:** `success` — all four jobs passed on GitHub's isolated runner.

## Accepted native checks

| Gate | Result | Evidence/scope |
|---|---|---|
| QA-01 | PASS | Node 24.20.0; pnpm 11.23.0; disposable PG18 and Valkey services |
| QA-02 | PASS | Full monorepo native build, typecheck and Vitest completed successfully |
| QA-03 | PASS | All 25 migrations (`0000`–`0024`) applied by canonical migration verifier in disposable PG18 |
| QA-04 | PASS | Canonical verifier reversed entire migration chain, verified tables absent, reapplied full chain and probed readiness; no production rollback attempted |
| QA-05 | PASS for covered native scope | Full native identity/RBAC plus dedicated M04 7/7 full-schema owner grant, workspace isolation and registry revocation tests |
| QA-06 | PASS for canonical queue scope | Native Valkey worker/queue retry and recovery gate passed; separately activated M04 live network queue was not exercised |

## M04-specific real PostgreSQL security tests: 7/7 PASS

1. Owner-approved live grant succeeds.
2. Non-owner member cannot approve live grant.
3. Cross-tenant domain verification binding rejected.
4. Cross-tenant M02 admission rejected.
5. Grant expiry beyond five-minute bound rejected.
6. Blocked current connector registry rejects historical `allow` snapshot at deferred COMMIT fence.
7. Grant UPDATE rejected (immutable approval).

All fixtures live in a transaction rolled back at the end of the test. The dedicated job uses `brovexa_m04_qa_live_test` on localhost; no production secrets, external reads, network crawls or deployment.

## Remaining gates (not certified)

- QA-07: Full M04-specific **live** worker end-to-end, storage/retention, replay recovery, external policy and live acquisition integration. Live network activation remains explicitly off.
- QA-08: Broader final security acceptance beyond seven DB-specific cases (SSRF/DNS transport rebinding, expiration races, cancellation, concurrency across queues). Native unit coverage exists but is not equivalent to production end-to-end certification.
- QA-09: PR #174 (`agent/database-persistence`, separate unmerged draft) differs from checkpoint `0018` migration and persistence model: checkpoint adds bounded safety budget columns and repairs PL/pgSQL dollar quote. **Do not merge without reconciling 0018 migration SHA and schema interface.** Its down SQL is identical; no PR changes were made.
- QA-10/11: Final exact merge-head checks, rollout/production config, staged live activation and deployment remain open. `main` and PR #174 untouched.

## Integrity and rollout rule

Do not rewrite migration journal checksums and do not treat a clean disposable test database as proof that an already-deployed production schema is migratable without a separate migration-diff exercise. This checkpoint is a **green development QA milestone**, not a production activation decision.