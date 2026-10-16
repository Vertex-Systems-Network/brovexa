# Brovexa M04 — WEB-039/040 Grant Replay + Commit Guard

Date: 2026-10-16. Branch: `checkpoint/m04-local-web006-20261016`.

## WEB-039 — current authorization for identical grant replays

`persistWebsiteLiveGrant` no longer treats identical `(workspaceId,grant_hash)` as automatic authorization. A replay only succeeds when its original, unexpired owner-approved grant is still joined to an active workspace/user/owner membership, verified domain and allowed M02 source admission. The current records are locked (`FOR SHARE`) through transaction completion. An inactive grant throws `M04_LIVE_GRANT_INACTIVE`, and a mismatched hash or tenant remains `M04_LIVE_GRANT_CONFLICT`. Replay never extends expiry or repeats a fresh INSERT.

## WEB-040 — deferred grant INSERT commit fence

Forward migration `0023_website_live_grant_commit_guard` adds a deferred PostgreSQL constraint trigger. Even if the initial 0020 BEFORE INSERT guard allowed a grant, COMMIT must still see an active owner, workspace, verified domain, M02 approval and unexpired grant. The guard locks the relevant current rows through commit. Migration 0023 has separate reversible down SQL and must be applied after 0018–0022.

## Verification status

Native Vitest regression candidates added for grant replay success/refusal/conflict and the deferred migration schema. Per owner instruction: **NEW TESTS, NATIVE POSTGRESQL/VALKEY, CI, AND PR REVIEW HAVE NOT RUN**. M04 remains IN PROGRESS. No worker auto-registration, live production activation, PR #174 edit or `main` merge.