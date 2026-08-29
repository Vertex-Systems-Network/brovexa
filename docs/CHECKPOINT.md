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

PR #1 remains documentation/planning only and must not be interpreted as development authorization.

Planning docs now include:
- `docs/PROJECT_PLAN.md`
- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/CLIENT_SURFACES.md`
- `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`
- `docs/TECH_STACK_UI.md`
- `docs/WEBSITE_AUTH_BILLING.md`
- `docs/CHECKPOINT.md`

## Linear project
https://linear.app/abdulhanan237/project/brovexa-066a4b14d055

### Milestones
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
- M08B — Public Website, Identity & Monetization
- M09 — Security, Reliability, Scale & Cost Controls
- M10 — Beta, Production Readiness & Launch
- MX — Continuous Product & Market Intelligence

### Planning issues
Original planning: ABD-209 through ABD-225.

Multi-client/continuous-research expansion:
- ABD-226 — lock multi-client architecture for Web/Desktop/Chrome/Firefox
- ABD-227 — Desktop app
- ABD-228 — Chrome/Chromium extension
- ABD-229 — Firefox extension
- ABD-230 — cross-client auth/sync/deep links/capability contracts
- ABD-231 — specify 24-hour market/competitor research workflow
- ABD-232 — future implementation of daily GitHub research scout
- ABD-233 — technology stack and operator UI architecture ADR

Website/auth/monetization expansion:
- ABD-234 — public website IA, landing page and visual product storytelling
- ABD-235 — authentication, account recovery and onboarding lifecycle
- ABD-236 — packages, entitlements, Research Credits and unit economics
- ABD-237 — payment gateway ADR and checkout/subscription state machine
- ABD-238 — pricing, checkout, billing portal and renewal UX
- ABD-239 — taxes, invoices, refunds, dunning and billing records
- ABD-240 — SEO, analytics, attribution and conversion measurement

Linear document added: `Brovexa — Website, Authentication & Monetization Plan v1.0`.

## Current approval gate
`ABD-215 — M00 architecture/readiness approval gate` blocks feature implementation.

ABD-215 now additionally requires review/approval of:
- ABD-226 multi-client architecture
- ABD-231 daily market-intelligence specification
- ABD-233 technology/UI ADR
- ABD-234 through ABD-240 website/auth/commercial planning
- explicit owner consent after planning review

Planning/research/docs may continue. Feature code, payment-provider activation, GitHub daily-research workflow enablement and product implementation must not start before the gate and consent.

## Public website plan
The public website is planned as a visual product-conversion surface rather than a generic brochure.

Primary storytelling:
1. Hero: geography/niche discovery → Business 360 → BPO opportunity score
2. Discovery job visual
3. Business 360
4. Signals timeline
5. Opportunity reasoning
6. Evidence Inspector
7. Lead Queue and Why Now
8. Desktop + Chrome/Firefox workflow
9. Continuous Market Intelligence
10. Security/compliance
11. Pricing and final CTA

Visual rule: prefer real product screenshots/short UI videos/diagrams with synthetic demo data over generic stock imagery. Do not invent customer logos, metrics or integrations.

Recommended domain split for ADR review:
- `brovexa.com` — public marketing/product/pricing/resources
- `app.brovexa.com` — authenticated operator application and auth lifecycle
- documentation may use `/docs` initially; a separate docs host is optional later

## Authentication plan
Planned lifecycle:
- Login with email/password plus evaluated Google/Microsoft OAuth
- Register + policy-version acceptance + email verification
- Forgot/reset password with enumeration-safe behavior, single-use expiring tokens and rate limits
- MFA/passkey-ready session model
- workspace creation/invitations
- onboarding through use case → geography/niche → service taxonomy → Research Credits → guided first discovery → optional team/Desktop/extension setup

No auth provider has been selected yet.

## Package/pricing hypothesis
Pricing remains provisional until unit-economics validation.

- Free — $0, 1 seat, small monthly Research Credit pool
- Launch — proposed $49/mo, 1 seat, full core intelligence + Desktop/extensions
- Pro — proposed $149/mo, 3 seats, scheduled research + CRM/team workflows
- Growth — proposed $399/mo, 10 seats, API/webhooks + larger pooled research + advanced governance
- Enterprise — custom

Model: **subscription + included Research Credits + optional top-ups**. Normal navigation/saved views/basic CRM operations should not consume Research Credits. Cost-bearing search/enrichment/AI work does.

## Payment-provider plan
Provider selection is intentionally pending ABD-237 and actual operating-entity eligibility.

Candidates:
- Paddle — Merchant of Record candidate for global SaaS
- Stripe — direct processor/Billing candidate with Checkout/customer portal/tax tooling
- Lemon Squeezy — Merchant of Record alternative with SaaS subscription and usage-based capabilities

Canonical Brovexa entitlements remain independent from provider product/price IDs. Signed webhooks, idempotency, replay/reconciliation and server-side verification are mandatory. Browser checkout success alone never grants access.

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

Preferred first implementation option: deterministic GitHub Action + versioned Brovexa research runner. GitHub Agentic Workflows may be evaluated experimentally but should not be the sole dependency while preview status/fit remains a concern.

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

## Known unverified/unfinished items
- No technology ADR has been approved.
- No source connector exists.
- No database/schema migration exists.
- No auth provider has been selected.
- No payment provider has been selected or activated.
- Pricing has not passed unit-economics validation.
- No final legal/tax billing model has been approved.
- No queue/orchestrator has been implemented.
- No Web/Desktop/extension code exists.
- No public website/auth/billing code exists.
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
9. ABD-234–240 website/auth/monetization plan review, unit economics and payment-provider ADR

Then run the ABD-215 readiness audit and request explicit owner development consent.
