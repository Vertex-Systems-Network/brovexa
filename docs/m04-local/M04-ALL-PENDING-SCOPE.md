# Brovexa M04 — scope correction and live acquisition development

Date: 2026-10-16. Repo: Vertex-Systems-Network/brovexa.

## Corrected scope

Owner clarified that the word **Live** in the earlier "except Live" instruction was accidental. **All remaining M04 tasks, including the live website-read path, are in scope.** This correction supersedes the previous non-live-only exclusion. It does **not** establish that any production tenant/domain, external provider credentials, or deployment is ready or authorized at runtime.

## Live development delivered (WEB-026 candidate)

- `apps/worker/src/website-live-acquisition.ts` contains a deliberately opt-in, authenticated **v2 live root HTTPS read**, independent of the frozen WEB-001 **v1 test-only** provenance contract.
- Required workspace+inspection-bound trusted approval, verified canonical HTTPS root, separate M02 per-hop transport admission, expired-grant rejection, 1 MiB maximum budget and 30 second maximum timeout.
- DNS A results are rejected if empty, malformed or containing any known special-use/private IPv4 address. The approved public IPv4 is pinned in a direct HTTPS socket: TLS hostname/SNI verification is retained; no proxies, ambient authentication, redirects, cleartext HTTP, arbitrary paths, POST, or cookies.
- HTTPS response status/content-type/content-encoding, byte streaming budget, deadline, cancellation and a trusted response byte snapshot are checked. Live content is transient; only a SHA-256-scoped transport receipt is returned alongside transient in-memory body.
- `apps/worker/src/website-live-assessment.ts` invokes the shared conservative HTML extractor for an authenticated live root, returns a **v2** partial/review-required capability report, and clears the transient body before returning. It does not falsely represent a live acquisition as a v1 test fixture.
- `apps/worker/src/website-fixture-extractor.ts` now accepts a *minimal* authorized-root+byte-budget shape, so the same conservative HTML logic can be used for both separate v1 and v2 paths without changing frozen v1 contracts.
- Targeted isolated safety regression suite written at `docs/m04-local/offline-tests/website-live-*.test.mjs`.

## Verification actually performed

- `tsc --noEmit -p working/tsconfig.live.json`: PASS locally against TypeScript 5.8 / Node 22 typings; this is an isolated file-level check, **not** the native Brovexa toolchain.
- `node --experimental-strip-types ... --test offline-tests/website-live*.test.mjs`: **81/81 PASS**, 0 failed, all using injected DNS/transport; **no external hostname was contacted**.
- Prior non-live isolated offline checkpoint: 255/255 PASS in the previous batch, **not rerun here**.
- **NOT RUN**: native Node 24 + pnpm 11 full workspace typecheck/Vitest, PostgreSQL 18 migrations/rollback and concurrency, Valkey queue integration, integrated M02 evaluator against approved production source policies, production HTTPS connectivity, independent security approval and CI gate.

## Remaining release blockers (do not call M04 complete)

1. Add explicit, separately reserved **v2 live evidence schema/persistence**; existing migration 0018 currently constrains `network_requested=false` and `inspection_version='1.0.0'`. Never inject live reports into those columns or mislabel live receipts as test data.
2. Wire trusted workspace-scoped verification/permission and real M02 per-hop source admission into the live runner, and opt-in worker registration behind an operational feature gate. The development module takes an injected M02 admission callback; **no production evaluator or worker entry-point is activated here**.
3. Supply a fully provisioned Node 24/pg18/Valkey environment to execute native integration, migration up/down, cancellation/retry/recovery, and security gates.
4. Reconcile migration 0018 changes with the separate DATABASE draft PR #174 before merging to `main`. Existing PR and `main` must remain untouched until full review.
5. Use only a user-approved verified target/tenant for any actual external live-run or deployment; no target has been provided, and no live site was contacted in these tests.

The current code is a **development candidate**, not production activation or module acceptance.