# M04 QA-09 — PR #174 migration 0018 reconciliation (2026-10-17)

## Verified finding

PR #174 (open, branch \`agent/database-persistence\`, compared against M04 branch \`checkpoint/m04-local-web006-20261016\`) contains an older implementation of the same \`0018_website_inspection_evidence.up.sql\` migration. **The two UP migration files are not identical.** The M04 checkpoint requires \`max_pages\`, \`max_response_bytes\` and \`timeout_ms\` columns with \`website_runs_budget_check\`; these three columns are missing from the PR draft. The matching persistence adapter also differs.

Both branches use the same migration number and name, so the PR must **not** be merged or cherry-picked blindly after the M04 migration has been applied. Applied SQL history/checksums must not be silently rewritten.

## Safe integration plan (not yet executed)

1. Keep the M04 checkpoint's 0018 definition as the canonical budgeted variant while preparing an integration branch; run the new native migration compatibility guard.
2. Before merging PR #174, reconcile its persistence implementation and tests against canonical 0018. A merge conflict resolution must choose **one** identical migration definition, not combine two separate 0018 migrations or skip budget enforcement.
3. Re-run the complete Node24/pnpm11 native build and Vitest, PostgreSQL 18 \`0000–0024\` UP/DOWN/reapply, full-schema M04 security, and Valkey QA on the **exact final integration-tree SHA**.
4. If any deployed database has already applied the older 0018, investigate the real applied migration ledger **before** attempting migration or repair. Use an approved forward-only 0025 migration if data/schema transformation is required. Never mutate an already applied 0018 history.
5. No action on PR #174, \`main\`, deployment or production database is authorized by this QA report.

## Automated regression

\`scripts/verify-m04-migration-contract.test.mjs\` fails if the canonical M04 fixture-budget columns, v2 separation, or serialized migration reservations regress.

**Status: divergence identified and integration guard implemented. Final PR/main reconciliation remains OPEN until the final merged-tree QA is green.**
