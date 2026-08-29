# Brovexa Project Checkpoint

## State
Planning baseline expanded. Feature development is **not yet approved**.

## Verified repository baseline
- Default branch: `main`
- Original implementation state: only `README.md` with `# brovexa`
- Original initial commit: `49673ebd8d40133eaa00d3bd8d760ce4b372fd5a`
- No product implementation existed when planning began.

## Planning branch / PR
Branch: `planning/brovexa-baseline`

Draft PR: https://github.com/Vertex-Systems-Network/brovexa/pull/1

As of this checkpoint, PR #1 is open, draft, unmerged and mergeable. It remains documentation/planning only.

Planning docs now include:
- `docs/PROJECT_PLAN.md`
- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/CLIENT_SURFACES.md`
- `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`
- `docs/TECH_STACK_UI.md`
- `docs/CHECKPOINT.md`

## Linear project
https://linear.app/abdulhanan237/project/brovexa-066a4b14d055

### Core milestones
- M00 — Product, Compliance & Architecture Baseline
- M01 — Platform Foundation & Developer Experience
- M02 — Business Discovery & Source Connectors
- M03 — Entity Resolution & Contact Enrichment
- M04 — Website & Digital Presence Intelligence
- M05 — Demand, Intent & Opportunity Signals
- M06 — BPO Intelligence, Scoring & Explainability
- M07 — Outreach Strategy, CRM & Compliance Controls
- M08 — Dashboard, Search, Workflows & APIs
- M08A — Desktop & Browser Clients
- M09 — Security, Reliability, Scale & Cost Controls
- M10 — Beta, Production Readiness & Launch
- MX — Continuous Product & Market Intelligence

### Planning issues
Original planning: ABD-209 through ABD-225.

Expansion:
- ABD-226 — lock multi-client architecture for Web/Desktop/Chrome/Firefox
- ABD-227 — Desktop app
- ABD-228 — Chrome/Chromium extension
- ABD-229 — Firefox extension
- ABD-230 — cross-client auth/sync/deep links/capability contracts
- ABD-231 — specify 24-hour market/competitor research workflow
- ABD-232 — future implementation of daily GitHub research scout
- ABD-233 — technology stack and operator UI architecture ADR

## Current approval gate
`ABD-215 — M00 architecture/readiness approval gate` blocks feature implementation.

ABD-215 now also requires:
- ABD-226 complete
- ABD-231 complete
- ABD-233 approved
- explicit owner consent after planning review

Planning/research/docs may continue. Feature code, workflow enablement and product implementation must not start before the gate and consent.

## Current technology recommendation for ADR validation
Not yet final/implemented:
- Web: Next.js App Router + React + TypeScript
- UI: Tailwind CSS 4.x + shadcn/ui/Base UI + Brovexa tokens
- Desktop: Tauri 2 + Vite/React
- Extensions: WXT + React/TypeScript, shared Chrome/Firefox codebase with browser adapters
- Core backend: NestJS/TypeScript modular monolith
- Data: PostgreSQL + pgvector initially
- Queue: Redis + BullMQ initially; Temporal re-evaluation threshold documented
- Object storage: S3-compatible
- Observability: OpenTelemetry-compatible
- Monorepo: pnpm workspaces (+ Turborepo if justified)
- Python: only for AI/data workloads that materially benefit

## 24-hour research scout plan
The scout is specified but **not implemented**.

Recommended behavior after approval:
- GitHub scheduled run once daily at a non-top-of-hour minute (e.g. 08:17 Asia/Karachi)
- manual `workflow_dispatch`
- approved source registry
- competitor/API/platform/security/UX research
- structured evidence and confidence
- compare against existing Brovexa plan/backlog
- classify proposals as Add / Experiment / Watch / Reject
- deduplicate/no-spam
- hard search/fetch/model/cost budgets
- no auto-code, no auto-merge, no connector enablement

Preferred first implementation option: deterministic GitHub Action + versioned Brovexa research runner. GitHub Agentic Workflows may be evaluated experimentally but are currently public preview and should not be the sole dependency.

## Multi-client product state
Desktop and browser extensions are planned as clients of one canonical backend.

Browser-extension principle:
- focused side-panel helper, not a general-purpose hidden scraper
- current company matching
- evidence candidate capture
- signal/opportunity/score summary
- research trigger
- lead/list/task actions
- Web/Desktop handoff
- least-privilege browser permissions

Desktop principle:
- persistent daily operator shell
- Business 360/evidence/signals/opportunities/lead queue/research jobs
- native notifications
- secure deep links
- bounded offline cache only where policy permits

## Research-backed technical notes
- Tauri 2 provides a cross-platform native shell and WebView-based frontend model; Windows uses WebView2.
- WXT targets Chrome/Firefox/Chromium from a shared extension codebase.
- Chrome Manifest V3 uses service-worker background execution and removes remotely hosted executable extension code.
- Firefox Manifest V3 background behavior differs; browser-specific adapters/tests are required.
- GitHub scheduled workflows run from the default branch and can be delayed during high load, especially near the start of an hour.
- GitHub Agentic Workflows are public preview and support declared permissions/safe outputs.

## Known unverified/unfinished items
- No technology ADR has been approved.
- No source connector exists.
- No database/schema migration exists.
- No auth provider has been selected.
- No queue/orchestrator has been implemented.
- No Web/Desktop/extension code exists.
- No GitHub daily research workflow exists.
- No AI provider/model has been selected.
- No CI/tests exist because implementation has not started.
- No production legal/compliance sign-off exists.

## Next safe action
Complete M00 planning/ADR work, especially:
1. ABD-210 source-policy/compliance matrix
2. ABD-211 canonical data/evidence schemas
3. ABD-212 AI contracts/evals
4. ABD-213 threat model
5. ABD-214 architecture ADRs
6. ABD-226 multi-client architecture
7. ABD-231 daily research workflow specification acceptance
8. ABD-233 technology/UI ADR

Then run the ABD-215 readiness audit and request explicit owner development consent.
