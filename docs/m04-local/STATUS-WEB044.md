# Brovexa M04 — WEB-043 / WEB-044 (2026-10-16)

## Implemented

- WEB-043: trusted PostgreSQL owner-grant loader now requires current M02 connector status=`approved`, activation=`enabled`, credential_mode=`none`, public/first-party access method, policy state APPROVED/APPROVED_WITH_LIMITS, and an active review window. Grant replay and live evidence replay use matching JOINs and `FOR SHARE` locks, preventing retries from resurrecting invalidated policies.
- WEB-044: forward migration `0024_website_live_registry_revocation_guard` adds deferred COMMIT-time checks on both new live grants and new live evidence. Current source-admission identity is linked by the persisted connector/policy foreign-key references, NOT supplied by queue payload or a mutable callback. A disabled connector or expired review window fails closed.
- Added native Vitest regression candidates and reversible migration; module-level native PostgreSQL 18, Valkey and CI verification is deferred per project instructions.
- Migration 0018–0023 history left untouched; no live worker auto-registration or activation, network access or production deployment.

## Remaining acceptance

- Execute native PostgreSQL 18 migrations 0018–0024, rollbacks and concurrent policy revocation scenarios, then native worker/Valkey and end-to-end security acceptance at final module verification.
- Reconcile dedicated DB draft PR #174 before any merge. No production activation.

## Status

Development candidate only; NOT final/verified.