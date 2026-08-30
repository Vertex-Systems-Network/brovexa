# Brovexa — Operator UI, Design System & Interaction Architecture v1.0

Status: **Planning Only — UI system contract, not implementation authorization**

## Positioning

Brovexa is an **AI Business Intelligence Operations Console**, not a generic CRM template or spreadsheet clone.

Principles: evidence before assertion; explainability next to AI recommendations; global-search-first navigation; high information density with visible uncertainty; progressive disclosure; safe bulk operations; keyboard-friendly workflows; desktop-optimized responsive UX; shared Web/Desktop/Extension language.

## Component foundation

Use **Tailwind CSS + shadcn/ui open-code components + Base UI primitives** for new components. Brovexa owns its component code/tokens rather than shipping the default shadcn look.

Semantic tokens cover surfaces, text, borders, focus, intent, verified/inferred/stale/conflicted/unknown/policy-blocked intelligence states, lead priorities, AI run states, spacing, radii, typography, elevation, motion and density. Support light/dark through tokens with accessibility/contrast taking precedence.

## Navigation

Primary operator navigation:
1. Command Center
2. Discover
3. Businesses
4. Signals
5. Opportunities
6. Leads
7. Research Jobs
8. Market Intelligence
9. CRM / Integrations
10. Evidence
11. AI / Agent Center
12. Usage & Cost
13. Compliance
14. Team
15. Settings

Use contextual secondary navigation instead of an enormous permanent sidebar.

Global command/search supports entity/job navigation, approved research templates, tasks, Agent Center and workspace switching. High-impact/destructive actions do not bypass review through the palette.

## App shell

- collapsible left navigation
- top global search/command + workspace + notifications/help/profile
- content canvas
- optional right Evidence/AI/Filter inspector
- Comfortable and Compact density modes

## Command Center

Answers: what changed, what needs attention, which jobs are running/blocked, which Leads became important, which data is stale/conflicted and what is consuming unusual cost.

Sections: Priority Leads, Opportunities, Research Jobs, Review Queue, Agent/Connector failures, budget thresholds, Market Intelligence changes, Tasks/SLAs.

Avoid vanity metrics without action paths.

## Research Job Builder

Guided flow:
Objective → Geography → Industry/Niche → Business Filters → Digital Filters → Contacts → Signals → Sources → Depth/Quality → Output/Schedule → Budget → Preflight.

Support searchable geo/taxonomy trees, includes/excludes, AI natural-language compiler with visible structured output, explicit unknown semantics, transparent presets, policy/unsupported warnings and estimated cost/coverage.

Expert mode exposes compiled structured rules, never arbitrary unsafe source code.

## Businesses grid

Initial decision: **TanStack Table + TanStack Virtual when needed**, with server-side pagination/filtering/sorting.

Capabilities: configurable columns, saved views, pin/hide/reorder, explicit bulk selection scope, confidence/freshness, website/contact/signal/opportunity/Lead status, export eligibility and row preview.

Virtualization is a rendering optimization, not a replacement for server-side data operations.

AG Grid Enterprise is deferred until advanced spreadsheet/pivot/grouping behavior creates enough customer value to justify licensing/lock-in.

## Business 360

Header: canonical name, Account/Location context, operating state, website/domain, confidence/freshness, top opportunity, Lead state and actions.

Sections/Tabs: Overview, Locations, Digital Presence, Contacts/Buying Committee, Signals, Opportunities, Evidence, Research History, Lead/CRM, Timeline, Audit.

Evidence Inspector can stay open while reviewing facts/signals/opportunities.

## Evidence Inspector

Shows source/type/reference, observed/published/fetched/verified timestamps, policy-permitted evidence snippet, policy class, Fact vs Inference, confidence/freshness, contradictions, detector/model/rule version and Job/Agent lineage.

Permitted actions: verify/re-research, mark incorrect, note, contradiction compare and source-policy detail.

## Signals and Opportunities

Signal UI clearly separates explicit demand, inferred condition and negative/disqualifying evidence.

Opportunity view shows service ID/label, fit components, Why Now, positive/negative evidence, confidence/freshness, missing evidence, recommended research, affected Account/Location and Lead promotion state.

## Lead OS

Header: account, canonical stage, operational status, priority, owner/team, score, top service/opportunity, contactability/compliance and next-best action.

Panels: Why This Lead, Evidence/Signals, Contacts/Buying Committee, Qualification, Tasks, Research, Outreach Review, CRM Sync, Score/Stage History, Audit/Compliance.

Kanban is an optional projection, not the canonical state machine.

## Research Job UI

Show state/stage, progress/coverage, counts, current geo/source stages, work health, estimated/actual cost, retry/rate-limit/policy states, partial-result quality, pause/resume/cancel and run trace/checkpoints.

Never fabricate precise progress when total work is unknown.

## Agent Center / Memory Inspector

Agent Center: AgentRun role/model/version, autonomy, tools/sources, Context Receipt, token/API cost, confidence/evaluator, plan/handoffs/checkpoints and errors/retries.

Run Trace: Trigger → Plan → Agent/Tool → Evidence → Validator → Evaluator → Commit/Proposal.

Memory Inspector: namespace/type/subject, authority/confidence, provenance, freshness/status, conflicts/supersession, writer, permitted correction/supersede/delete controls.

## Compliance

Dedicated SourcePolicy, jurisdiction/channel, suppression, review queue, connector state and audit surfaces. Lead/Outreach screens show concise eligibility with drill-down rather than legal-text overload.

## Usage & Cost

Break down workspace/job/source/AI capability/time usage and show Research Credit balance, budget alerts, costly jobs, cost per verified business/opportunity/qualified Lead where data supports it.

## Server/client state

Use Next.js Server Components where appropriate and **TanStack Query v5** for interactive client-side server state requiring caching/background refresh/mutations. Do not mirror backend state into a large global store.

Client-only state is mainly unsaved builder/filter UI, dialogs/panels, temporary column configuration and command palette state. Prefer URL/search params for shareable filters/views.

## Required states

Every data surface defines loading, background refresh, empty, filtered-empty, partial, stale, conflict, permission denied, entitlement blocked, policy blocked, rate limited, offline/reconnecting where relevant, retryable/non-retryable error, archived/deleted/suppressed state.

Avoid full-screen spinners after initial shell when partial/skeleton content is safer.

## Accessibility

Target WCAG 2.2 AA behavior: keyboard navigation, visible focus, semantic structure, accessible names, correct dialog/popover focus, accessible data-grid interaction, contrast-safe statuses, text/icon redundancy, reduced motion and async announcements.

Base UI helps with primitives but custom Brovexa components still require accessibility tests.

## Responsive

Desktop: full console/grids/inspectors.
Tablet: collapsed nav, one inspector, reduced grid columns.
Mobile: notifications/review, Lead/Business summary, evidence review, task/action approval and job status; do not force the complete worldwide ResearchJob builder into a poor small-screen experience.

## Desktop and Extension reuse

Desktop shares tokens/domain components/API client but keeps native functionality behind adapters.

Extension is a compact purpose-built view: current business match, confidence, top signals/opportunity, evidence capture, research/add Lead/open Brovexa. It is not a mini full dashboard.

## Decisions

- Tailwind + shadcn open-code + Base UI: LOCKED baseline
- Brovexa semantic token system: LOCKED
- TanStack Table + Virtual: LOCKED baseline
- TanStack Query for interactive server state: LOCKED where needed
- AG Grid Enterprise: DEFERRED with trigger
- broad global client state store: rejected by default
- final visual palette/typeface: design decision pending