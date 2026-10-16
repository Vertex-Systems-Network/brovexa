# Brovexa M04 — WEB-041/042 development checkpoint

Branch: `checkpoint/m04-local-web006-20261016`.

## WEB-041: fail-closed live grant reads
- Hardened `getWebsiteLiveGrant` SQL to join the verified workspace/business/domain decision, rather than relying only on an original foreign key/owner and historical allow admission.
- Fresh live grant reads require exact workspace, request/task identity, connector identity, source-policy snapshot, canonical root URL, executable fetch operation, acceptable robots decision, and both raw payload/export flags disabled.
- Refuses future-dated approval or expired grant at the read boundary.
- Added native Vitest SQL-scope and null-grant regression candidates.

## WEB-042: resolver adapter trust boundary
- Removed the call to an untrusted resolver array `.some()` method and all user-defined array iteration callbacks during public DNS preflight.
- Requires dense own-data A-record array, <=32 records, no extra keys/accessor entries, and all records to be public IPv4 before M02 admission or the HTTPS dial.
- Added regression candidates for overridden `.some()`, accessor-bearing DNS array and sparse DNS data; no public website was contacted.

## Verification state
- Source and tests authored locally; native TypeScript, Vitest, PostgreSQL 18, Valkey, CI and PR review intentionally NOT RUN before final M04 gate, per instruction.
- Remaining: real M02 registry provider-policy invalidation, native migrations 0018–0023 up/down, worker replay and cancellation, final security signoff; no production activation or merge.