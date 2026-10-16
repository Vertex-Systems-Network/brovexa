# Brovexa M04 — consolidated non-live development batch

Date: 2026-10-16. Scope: **all M04 work allowed without live HTTP, DNS, crawling, provider credentials or outbound contact**. This is a development checkpoint, **not** an assertion of production readiness.

## Integrated software deliverables

- WEB-001 strict public contract and WEB-003..025 fixture-only acquisition/attestation/extraction, authorization, cancellation, worker registration, database handoff.
- WEB-002 PostgreSQL migration 0018 and persistence code integrated as a snapshot of the existing draft PR #174, preserving its migration reservation. The migration/persistence are hardened for contract-mandatory source-policy snapshot, bounded review state, hard retention/deletion requirements, and persisted per-inspection request limits for replay/incident forensics.
- `website-inspection-native-integration.ts`: actual WEB-001 schema parse + WEB-002 transactional DB writer + opt-in work-handler, with workspace-authorized deletion and a strictly injected fixture-only transport. Does not activate a worker, connect to a database, or start a network client at construction.
- Regression tests for the above source, DB validation, rollback/idempotent replay and no auto-activation. No raw HTML/body data is persisted.

## Critical boundaries

- LIVE EXCLUDED: no DNS/HTTP, real-domain scanning, production SSRF hops, credentialed provider calls, outreach, or real site assessment.
- Worker handler is opt-in. Existing `apps/worker/src/main.ts` is deliberately **not** modified to start M04 automatically.
- Trusted request lookup, verified-domain admission manifest, tenant storage policy and RBAC must come from independently authorized DB sources. These are explicit required dependencies, not fabricated default approvals.
- The existing draft DATABASE PR #174 is not modified or merged; migration 0018 is re-used in this isolated checkpoint with a potential divergence that must be reconciled before mainline merge.
- Work completion effect and evidence write live in distinct existing framework transaction boundaries; cancellation cannot undo a database write after it has begun. Replay is idempotent but cannot prove atomic cross-subsystem completion. This remains a release-blocking native integration concern.

## Native verification required before declaring module complete

1. Node 24.20+ / pnpm 11.23 exact native workspace install, TypeScript and Vitest.
2. PostgreSQL 18 migration 0018 up/down and synthetic tenant-scope/FK/trigger/idempotence/concurrency tests.
3. Valkey work delivery, cancellation, retries and recovery.
4. Independent security review and exact-head full gate.

No test/check should be represented as PASS unless actually executed. One combined batch is being pushed to the isolated M04 checkpoint branch, not main.