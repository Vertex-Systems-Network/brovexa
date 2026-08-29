# Brovexa Project Checkpoint

## State

Planning baseline has been materially expanded. **Feature development is not yet approved.**

Original repository state before planning: default branch `main`, initial commit `49673ebd8d40133eaa00d3bd8d760ce4b372fd5a`, only README with `# brovexa`, no product implementation/issues.

Planning branch: `planning/brovexa-baseline`
Draft PR: https://github.com/Vertex-Systems-Network/brovexa/pull/1

PR #1 is documentation/planning only. It is not development authorization.

## Current product definition

Brovexa is now planned as an AI-native global business discovery, research, opportunity and lead-intelligence platform with:
- public website + auth/onboarding + pricing/billing
- web operator app
- Windows-first desktop client candidate
- shared Chrome/Chromium + Firefox extension candidate
- provider-neutral API/webhooks/integrations
- AI Agent OS + durable memory
- Global Acquisition Studio + background research jobs
- universal business signal/opportunity ontology
- BPO/service opportunity reasoning
- Lead Intelligence Operating System + AI Lead Copilot
- controlled outreach/CRM
- 24-hour product/market research scout.

## Planning documents

- `docs/PROJECT_PLAN.md`
- `docs/ENGINEERING_CONSTITUTION.md`
- `docs/AI_AGENT_MEMORY_OS.md`
- `docs/GLOBAL_ACQUISITION_STUDIO.md`
- `docs/UNIVERSAL_SIGNAL_ONTOLOGY.md`
- `docs/LEAD_INTELLIGENCE_OS.md`
- `docs/CLIENT_SURFACES.md`
- `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`
- `docs/TECH_STACK_UI.md`
- `docs/WEBSITE_AUTH_BILLING.md`
- `docs/CHECKPOINT.md`

## Linear milestones

Core: M00, M01, M02, M03, M04, M05, M06, M07, M08, M09, M10.

Expansions:
- M01A — AI Agent Runtime & Memory OS
- M02A — Global Acquisition Studio & Background Research
- M06A — Lead Intelligence Operating System
- M08A — Desktop & Browser Clients
- M08B — Public Website, Identity & Monetization
- MX — Continuous Product & Market Intelligence

## Planning issues

Original/core: ABD-209–225.
Multi-client/research/stack: ABD-226–233.
Website/auth/monetization: ABD-234–240.
AI-native maturity expansion:
- ABD-241 — AI Agent OS + durable memory architecture
- ABD-242 — global geography/taxonomy + Acquisition Job Builder contracts
- ABD-243 — Lead Intelligence OS canonical model/lifecycle
- ABD-244 — future Agent Runtime/Memory implementation
- ABD-245 — future geography/taxonomy registry + Job Builder implementation
- ABD-246 — future source/acquisition-mode catalog/router
- ABD-247 — future durable background acquisition orchestration
- ABD-248 — universal business signal/event/opportunity ontology
- ABD-249 — future Lead OS workspace/lifecycle/routing
- ABD-250 — future AI Lead Copilot/next-best-action
- ABD-251 — CRM/inbound/import synchronization plan.

## AI Agent OS / memory state

Architecture is planned but not implemented.

Agent pattern: trigger → Orchestrator → Context Builder → bounded specialist agents → deterministic validators → Evidence Verifier → Independent Evaluator/Critic → canonical state + memory/checkpoint.

Logical agents include control/compliance/security/cost/memory roles plus discovery, geo/source planning, entity/contact, website, signals, procurement, workforce, technology, CX, opportunity, lead qualification/scoring/routing, buying committee, next-best-action, outreach and market research roles.

Memory types are explicit: working/run, semantic, episodic, procedural, entity, lead, research and workspace/user. Memory is not raw conversation history. It must be provenance-aware, versioned, scoped/ACL-controlled, stale/conflict-aware and deletable. Verified facts remain separate from AI memories.

Long-running agents may not rely on transient LLM context as authoritative state. Jobs/plans/work units/handoffs/checkpoints are durable.

## Global Acquisition Studio state

Product/architecture is planned but no connector or acquisition runner exists.

Research Job Builder:
Objective → Geography → Industry/Niche → Business/Digital Filters → Contact Target → Signals → Sources → Depth → Quality → Output → Schedule → Budget → Preflight → Run.

Geography design: World/UN M49 regions → ISO countries → subdivisions/admin hierarchy → cities/localities → postal/radius/polygon/custom territory; aliases/native names and dataset versions.

Taxonomy design: Brovexa canonical taxonomy mapped to ISIC Rev.5, NAICS 2022/version-ready revisions, NACE Rev.2.1, Google Places/provider categories and custom niche keywords.

Sources are individual policy/capability adapters: maps/local, registries/open data, directories, first-party sites, jobs, procurement/tenders, news/search, approved reviews/social, technical/technology, funding/company data, licensed B2B, CRM/customer first-party, manual/CSV/API/webhooks, future partner/MCP. `Internet` is never an unrestricted adapter.

Background ResearchJobs are planned to shard into idempotent WorkUnits and support preview, pause/resume/cancel, recurring/continuous modes, budgets, source quotas, retries/dead-letter/review, exact progress, partial results and checkpoints.

## Universal signal ontology state

Ontology is planned/versioned rather than hardcoded. Families cover corporate lifecycle; funding/growth; workforce; procurement/RFI/RFP/RFQ/tenders; product/market; technology; digital presence; customer experience; operations; sales/GTM; BPO/support; back-office; security/risk; regulation/public record; facilities/property; events/media/community; competitor/market; customer-authorized first-party inbound; and custom future signals.

`SignalDefinition` is separate from `SignalObservation`. Explicit requests remain distinct from inferred needs. Evidence, dates, freshness/decay, confidence, negative evidence and versions are required.

## Lead Intelligence OS state

Lead is planned as a first-class canonical commercial object distinct from Business, Contact, Signal, Opportunity and Deal.

Default lifecycle: Candidate → Researching → Qualified/Disqualified → Ready for Review → Assigned → Contact Ready → Outreach Approved → Contacted → Engaged → Meeting/Discovery → Deal/Proposal → Won/Lost/Nurture/Suppressed.

Planned features: Lead Inbox, qualification, score history, smart lists/audiences, tags/custom fields, ownership/territory/round-robin routing, buying committees, next-best-action, tasks/SLAs, aging/stale/research loops, nurture/reactivation, attribution, dashboards, bulk safety and provider-neutral CRM/import sync.

AI Lead Copilot can explain/research/recommend/draft, but may not override compliance/suppression/ownership/human gates.

## Public/commercial state

Public visual landing/product site, auth/register/recovery/onboarding and package/payment planning exist. Package hypothesis remains provisional: Free $0, Launch $49/mo, Pro $149/mo, Growth $399/mo, Enterprise custom using subscription + Research Credits + top-ups. Exact credits/prices require unit-economics validation.

Payment ADR candidates: Paddle MoR, Stripe Billing/direct processor, Lemon Squeezy MoR alternative. No provider is selected/activated; canonical entitlements remain provider-neutral.

## Client state

Desktop/browser extensions are clients of one backend. Candidate technology: Tauri 2 for Windows-first desktop and WXT/React/TypeScript shared Chrome/Firefox extension. No client code exists.

## Technology hypothesis

Not approved/implemented: Next.js/React/TypeScript; Tailwind/shadcn; NestJS modular monolith; PostgreSQL + pgvector initially; Redis/BullMQ initially; evaluate Temporal if durable multi-day orchestration complexity justifies it; S3-compatible object storage; OpenTelemetry; pnpm monorepo; Python only for AI/data workloads with concrete advantage.

## 24-hour market intelligence scout

Specified but not implemented. Planned GitHub daily scheduled research at off-hour minute plus manual dispatch, approved source registry, structured evidence, competitor/API/platform/security/UX/commercial deltas, Add/Experiment/Watch/Reject proposals, dedup/no-spam and hard budget. No auto-code/merge.

## Current approval gate

`ABD-215` blocks development. It now requires review of source/compliance/data/AI/threat/architecture baseline plus multi-client, market scout, tech/UI, website/auth/billing, Agent OS/memory, global acquisition, Lead OS and universal signal ontology; then explicit owner consent.

Implementation issues ABD-244–247 and ABD-249–251 remain Planning Only.

## Known unverified/unimplemented

No production code; no DB schema/migrations; no CI/tests; no auth/payment/model provider selected; no Agent Runtime/memory store; no geography registry; no source connectors; no background ResearchJob runner; no signal engine; no Lead OS; no web/desktop/extensions; no payment integration; no daily GitHub scout; no production legal/compliance/tax sign-off.

## Next safe pre-development work

1. Finish ABD-210 source/policy/privacy/outreach matrix.
2. Expand ABD-211 canonical schemas to include AgentRun/Memory/Geo/ResearchJob/Lead objects.
3. Reconcile ABD-212 AI contracts/evals with Agent OS roles.
4. Expand ABD-213 threat model for memory poisoning, agent permissions and global acquisition.
5. Finish ABD-214 architecture ADRs including durable workflow/memory choices.
6. Review/approve ABD-241, ABD-242, ABD-243 and ABD-248 specs.
7. Close ABD-226, ABD-231, ABD-233 and ABD-234–240 remaining M00 decisions.
8. Run full contradiction/gap/readiness audit.
9. Present explicit development-consent gate; do not infer consent from `continue`.