# Brovexa M04 — WEB-034/035 development checkpoint

Date: 2026-10-16
Branch: `checkpoint/m04-local-web006-20261016`
State: IN PROGRESS / unverified native integration

## Delivered source (local, ready to push)

- WEB-034: bounded deadline for trusted live request DB reads even when cancellation checks remain false; abort-aware and bounded deletion-RBAC callback.
- WEB-035: new migration `0020_website_live_authorization_grants` (forward & rollback) storing a 5-minute owner-approved live grant, cross-workspace FK to the verified business domain, cross-workspace FK to the M02 approved source-admission snapshot, owner membership trigger, immutable grant rows, and live-v2 evidence FK to owner grant.
- WEB-035: `website-live-grant-persistence.ts` idempotent atomic owner grant write; scoped read with active workspace, owner and approved M02 source policy constraints, with non-executable JSON-safe policy snapshot.
- WEB-035: new opt-in canonical worker registration backed by PostgreSQL grant reads and freshly derived M02 transport request/DNS evidence. No network activity during module import or handler construction.
- WEB-035: pure M02 admission seam extracted without weakening the existing callback-based API.
- Native Vitest regression candidates added for grant persistence, opt-in worker registration, hung lookups and deletion authorization.

## Verification still required before declaring M04 complete

- Native Brovexa workspace TypeScript/Vitest/Zod, PostgreSQL 18 migrations 0018→0019→0020 up/down and constraints, Valkey queue/worker recovery, security/SSRF audit, real RBAC permissions, end-to-end live job under explicit owner approval.
- Native acceptance including attempted cross-tenant writes, replay conflicts, revoked owner checks and migration 0020 FK behavior.
- No production live activation or deployment; no changes to `main` or database draft PR #174.
- **No new tests or CI checks executed for WEB-034/035**, per owner request to verify when the module is complete.