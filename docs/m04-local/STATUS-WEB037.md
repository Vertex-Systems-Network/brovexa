# Brovexa M04 WEB-037 — grant reauthorization on identical live evidence replay

Date: 2026-10-16 · Branch: `checkpoint/m04-local-web006-20261016`

WEB-037 fixes a replay authorization gap: migration 0021's `DEFERRABLE AFTER INSERT` trigger runs for newly persisted evidence, but `ON CONFLICT DO NOTHING` replays do not invoke it. After verifying the original immutable payload hash and workspace, a replay now checks the *current* owner, user/workspace status, verified-domain binding, M02 source admission, original approval/evidence timing, grant expiry and approved budgets. The replay query holds `FOR SHARE` row locks until transaction COMMIT to constrain concurrent revocation. Missing/expired/revoked grants fail closed (`M04_LIVE_DB_GRANT_INACTIVE`), which the worker translates to a redacted permanent work error. Wrong-tenant and changed-evidence replays still fail with `M04_LIVE_DB_ID_CONFLICT` before reauthorization.

This changes no migration and does not reactivate expired approvals. Native Vitest regression candidates were added to DB and worker specs for authorized replay, expired approval denial, tenant conflict and error classification. **New tests, native PostgreSQL18 / Valkey, CI and migration rollback acceptance have not been run** per owner instruction; isolated source changes are not verified as production ready. The PostgreSQL authorization guard for fresh inserts remains migration 0021.

Deployment / main / DATABASE PR #174 untouched. Existing full module gates remain OPEN.