# Brovexa — Launch Product Scope, Personas & Service Taxonomy

Status: **M00 planning — implementation not authorized**

## Product definition
Brovexa is an AI-native global business discovery, research, evidence, opportunity and Lead Intelligence Operating System. Workspaces define what they sell and whom they want to find; Brovexa compiles that intent into policy-aware ResearchJobs, builds canonical business intelligence, detects evidence-backed signals/opportunities, qualifies Leads and maintains durable agent/lead memory.

It is not a Google Maps scraper, generic email-list generator or autonomous bulk-outreach bot.

## Personas
- Owner / Workspace Admin
- Research / Intelligence Analyst
- Sales / Business Development
- Team Manager
- Reviewer / Approver
- Compliance / Data Steward
- Auditor / Read-only
- Restricted Automation / Service Account

## Core jobs
1. Find businesses/accounts/locations by global geography and niche.
2. Filter by business/digital/contact/signal conditions.
3. Verify websites, business facts and allowed contact routes.
4. Detect explicit requests and implicit signals from approved sources.
5. Map evidence to workspace-configurable services and explain why now.
6. Convert qualified opportunities into Leads without duplicating canonical entities.
7. Prioritize, identify missing research/buying roles and recommend next actions.
8. Run once/scheduled/continuous background research within budgets/policies.
9. Maintain durable history/memory for incremental re-research and evaluation.
10. Integrate with CRM/API/imports without provider IDs becoming canonical identity.

## Product surfaces
- Public website + pricing/resources/security/auth entry
- Web operator application as primary control plane
- Windows-first Desktop client
- Shared Chrome/Chromium + Firefox browser helper
- Versioned API/webhooks/integrations

## Default service catalog
Machine-readable canonical IDs and version rules live in `SERVICE_TAXONOMY_REGISTRY.md`. Display labels below are product wording, not canonical identity.

### Customer Experience & Contact Center
Inbound support; email/chat; technical/helpdesk; phone/contact center; multilingual; 24/7/after-hours; virtual receptionist; complaint/escalation; order/returns/refunds; retention/win-back.

### Sales & Revenue Operations
Lead research/list building; enrichment/qualification; appointment setting; inbound qualification; outbound SDR/BD support; CRM operations/data hygiene; reactivation; event follow-up; partner/channel support.

### Ecommerce & Marketplace Operations
Order management; product/catalog data; marketplace ops; returns/refunds admin; customer messaging; inventory/order coordination; merchant support.

### Back Office & Administration
Data entry/cleansing/enrichment; document processing; transcription; virtual assistance; scheduling/dispatch; research/reporting; procurement/vendor admin; real-estate inquiry admin; hospitality reservation/guest messaging.

### Finance & Accounting Operations
AP/AR admin; invoicing/billing support; lawful payment-reminder admin; bookkeeping support; reconciliation/data preparation; expense/data processing.

### HR & Recruitment Operations
Sourcing/coordination; candidate admin; interview scheduling; HR records/admin; payroll admin support; seasonal workforce operations.

### Data, Content & Localization
Research/enrichment; classification/tagging; content ops; translation/localization; multilingual catalog/support content; moderation only under approved risk controls.

### IT / Digital Operations
IT/helpdesk; CRM/helpdesk administration; website/ecommerce operations support; integration/data operations.

### User-defined adjacent services
Web/ecommerce development, SEO/digital marketing, AI/automation, software/integration, consulting, recruitment, data/research, localization and other lawful workspace-defined services. These remain distinct from Brovexa's default service taxonomy and are namespaced custom or `svc.adjacent.*` registry entries.

## Service registry invariants
- Opportunities reference `serviceId + serviceDefinitionVersion`, not display text.
- Canonical IDs are immutable; translations/renames do not rewrite history.
- Signal-to-service mappings are evidence-weighted hypotheses, not facts.
- Workspaces may enable/disable services, add custom services, change weights and impose industry/geography/evidence restrictions.
- AI cannot silently invent a production service outside the registry.

## Research objective families
Business/location discovery; website/no-website; contacts/personas; hiring; funding; expansion/facilities; RFI/RFP/RFQ/tenders; vendor/supplier/outsourcing requests; partnerships/distributors/franchises; product/market events; technology changes; digital gaps; CX/review pain; operations capacity; sales/GTM; licensing/regulatory/public records; news/events; competitor changes; authorized first-party inbound; custom versioned SignalDefinitions.

## AI authority
AI may plan, research, extract, summarize, classify, score, explain, recommend, re-research and draft. Deterministic/server controls own authentication, authorization, billing/budget, source policy, suppression, canonical IDs, irreversible deletion, entitlement provisioning and audit integrity.

Initial launch keeps material merge ambiguity, suppression override, bulk high-impact operations and outbound sends under policy/human control.

## Implementation sequencing
The complete scope is retained but is implemented in durable waves defined in `LAUNCH_SCOPE_WAVES.md`:
- Wave A — Core Usable Intelligence Platform
- Wave B — Client & Commercial Beta
- Wave C — Scale, Automation & Ecosystem

Wave assignment means sequencing, not cancellation. Wave A contracts must already support later public website/billing, Desktop/extensions, broader connectors, CRM and controlled automation without incompatible schema rewrites.

## Non-goals
- unrestricted scraping or provider-ToS bypass
- storing data without applicable rights
- bypassing source/privacy rules through natural-language jobs
- unauthorized personal-contact enrichment
- autonomous mass outreach at launch
- silent self-training/model/prompt mutation from outcomes
- treating inferred need as explicit customer request
- client-side authority over tenant/billing/compliance/canonical rules

## Readiness rule
A feature is implementation-ready only when user behavior, states, data/provenance, permissions, source/compliance, cost, failure/recovery, tests/evals and owning issue/document are traceable through ABD-252.