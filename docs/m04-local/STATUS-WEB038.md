# Brovexa M04 WEB-038 — crash-safe retention work-unit replay

Date: 2026-10-16 · Branch `checkpoint/m04-local-web006-20261016`

WEB-038 introduces migration 0022 and `purgeExpiredWebsiteLiveInspectionEvidenceForWork`, a tenant-scoped, canonical-work-unit keyed retention receipt recorded in the same PostgreSQL transaction as expired evidence deletion. Transaction-scoped advisory locking serializes duplicate deliveries of the same work ID. A successful prior receipt returns the same deleted count without deleting additional rows, including on Valkey retry after the original DB COMMIT but before work-unit completion. Cross-tenant or changed-budget work-ID reuse fails closed. The existing manual purge helper remains available for explicitly authorized use outside the worker, but the canonical retention worker now uses the durable replay-safe helper.

Migration 0022 adds an immutable receipt table with bounded rows, deterministic work IDs and reversible down SQL. Vitest regression candidates cover first execution, idempotent replay, tenant mismatch, rollback and stable effect metadata. New native tests, PostgreSQL 18 migration up/down, Valkey recovery and CI have **NOT RUN** per owner instruction. No claims of final module acceptance, production activation or live-service testing.

`main`, DATABASE PR #174, deployment untouched.