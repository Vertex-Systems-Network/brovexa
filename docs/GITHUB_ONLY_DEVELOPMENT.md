# GitHub-only development (no local CLI required)

Status: **development workflow supported**; this is not a deployed Brovexa environment.
Baseline: main `73d27f2762b626ee854a06e97dd007346a08c84c`, synchronization epoch 87 (2026-10-15 onboarding snapshot). Live state always comes from current `main`, issues #50/#53, and `coordination/leases`.

## What "no CLI" means

Developers may use GitHub's web interface or an authorized GitHub connector to read/edit files, manage Git branches, open pull requests, and review logs. They do **not** need a terminal, local `git`, GitHub CLI (`gh`), a cloned repository, Docker, or installed Node.js to submit changes for review.

This is a **client-side workflow preference**, not a request to remove application runtimes or shell commands from GitHub Actions. CI still needs `node`, `npm`, `pnpm`, PostgreSQL, and Valkey on hosted runners to build and verify the application. Never disable required tests or lease/security gates just to eliminate terminal commands.

The inspected workspace contains `apps/api`, `apps/web`, `apps/worker`, and the shared packages; root/app package manifests do not declare a shipped Brovexa CLI `bin`. No application CLI needs to be turned off for this workflow. If an application CLI is added later, review and explicitly gate its public entrypoint; do not confuse it with the local Git/GitHub command-line tools.

## Workflow: GitHub web / authorized connector only

1. **Read sources of truth:** start from exact current `main`; read `AGENTS.md`, `docs/CHECKPOINT.md`, issue [#50](https://github.com/Vertex-Systems-Network/brovexa/issues/50) (synchronization) and issue [#53](https://github.com/Vertex-Systems-Network/brovexa/issues/53) (live slot registry). The versioned checkpoint is not the live slot authority.
2. **Choose one bounded work packet:** declare scope, dependencies, affected paths and tests. Do not take work owned by an occupied lane. Supervisor owns shared integration files and the initial assignment transaction.
3. **Obtain assignment and lease:** use only an assignable `OPEN` planned slot (Supervisor may use its own `SUPERVISOR` slot), synchronize the standing branch, update/re-read issue #53, and atomically create the matching `.leases/<SLOT_ID>.json` on `coordination/leases` before writing the work branch. Follow `docs/AGENT_BRANCH_LEASES.md`; never overwrite another instance's lease.
4. **Change repository files:** use GitHub's file editor or GitHub connector create/update actions on the assigned branch, not on `main`. Preserve existing contracts and tests; make small, independently reviewable commits. Do not paste secrets into issues, PRs, logs, or repository files.
5. **Open a PR targeting `main`:** populate every field in `.github/PULL_REQUEST_TEMPLATE.md`. Include the **exact current head SHA**, instance/lease identifiers, synchronized main SHA and epoch, dependencies, scope, verification and known limitations. The preflight contract in `scripts/pr-handoff-contract.mjs` is enforced by CI; if the branch head changes, update the handoff and submit a fresh completion signal.
6. **Use hosted CI instead of local commands:** opening/updating the PR automatically triggers the [CI workflow](https://github.com/Vertex-Systems-Network/brovexa/actions/workflows/ci.yml). Review all three required lanes: quality/security, PostgreSQL migration/RBAC, and worker/Valkey. Fix failures on the assigned branch and let the changed head rerun. A manual workflow run is also available at **Actions → CI → Run workflow** for an extra check on a selected ref, but **does not replace** PR-specific lease validation or exact-head merge gates.
7. **Integrate with protection:** require a valid fresh submission, exact-head full-gate success, reviewer/Supervisor checks and expected-head protected merge. Never push directly to `main` or bypass CI. Following merge, re-read main, verify resulting-main CI, advance the issue #50 epoch, synchronize affected branches non-destructively, and release the slot/lease safely.

## What can be paused safely

- **Local Git/GitHub CLI usage:** stop running `git` and `gh` on developer devices; use GitHub web/connector for all repository operations.
- **Local builds and database containers:** defer local execution; rely on hosted, isolated GitHub Actions for verification. This does **not** create a running preview or a production deployment.
- **Production integrations:** they remain separately gated as before. No real provider-network activation, production credentials, billing or autonomous outreach is implied.

**Do not pause:** pinned dependency installation, security scans, full quality gates, migration checks, PR lease verification, provenance checks, branch protections, or exact-head reviews. These are part of safe GitHub-only development, not optional CLI usage.

## Limitations and exit criteria

GitHub-only development proves changes through remote CI; it cannot establish visual browser QA, local performance, a production deployment, or real provider/data integrations. Record these as unverified instead of declaring a feature release-ready. When local execution becomes available, follow `docs/DEVELOPMENT.md`; the CLI-free mode can continue for ordinary Git/PR operations.
