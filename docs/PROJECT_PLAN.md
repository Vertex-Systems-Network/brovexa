# Brovexa Project Plan

## Product mission
Brovexa is an AI-native global business intelligence platform that discovers target businesses, resolves trustworthy canonical entities, enriches public/authorized business information, verifies digital presence, detects explicit and implicit demand signals, identifies BPO/service opportunities, scores those opportunities transparently, and prepares compliant human-reviewable outreach.

Brovexa must remain source-agnostic and must not depend on unrestricted copying of any single provider's dataset.

## Product surfaces
Brovexa is planned as one canonical platform with four first-class clients:
- Web operator application
- Desktop operator application
- Chrome/Chromium extension
- Firefox extension

Clients share versioned API/domain contracts. Canonical business facts, evidence, signals, opportunities, scores, compliance state and audit history remain backend-owned.

Detailed client plan: `docs/CLIENT_SURFACES.md`.

## Canonical intelligence pipeline
Discovery → Source Normalization → Entity Resolution → Contact Enrichment → Website Intelligence → Demand/Intent Signals → Evidence Verification → Opportunity Reasoning → Lead Scoring → Decision-Maker Routing → Outreach Strategy → CRM/Feedback

Each stage must be independently retryable, idempotent, versioned, observable and policy-aware.

## Milestones

### M00 — Product, Compliance & Architecture Baseline
Feature development is blocked until this milestone and the explicit owner-consent gate are approved.

Linear gates:
- ABD-209 — Product scope, personas, workflows, service taxonomy
- ABD-210 — Source-policy, privacy, outreach compliance matrix
- ABD-211 — Canonical data, evidence, provenance, lifecycle schemas
- ABD-212 — AI agent contracts, structured outputs, evaluation gates
- ABD-213 — Threat model including web fetching, AI and tenant boundaries
- ABD-214 — System architecture, deployment, queues, storage and cost model
- ABD-226 — Multi-client architecture for Web/Desktop/Chrome/Firefox
- ABD-231 — 24-hour market/competitor research workflow specification
- ABD-233 — Production technology stack and operator UI architecture
- ABD-215 — Explicit M00 architecture/readiness + owner-consent gate

### M01 — Platform Foundation & Developer Experience
Linear: ABD-216

Establish repository standards, environment boundaries, secrets, migrations, queues/workers, API conventions, auth/RBAC/tenant primitives, test/eval harnesses, CI quality/security gates, observability, health checks, ADRs, runbooks and checkpoints.

### M02 — Business Discovery & Source Connectors
Linear: ABD-217

Create the source-adapter framework and compliant geography/niche discovery with provider policy contracts, quotas, costs, attribution, provenance, pagination, resume coverage and connector health.

### M03 — Entity Resolution & Contact Enrichment
Linear: ABD-218

Build canonical business identity, deterministic and AI-assisted matching, confidence/review thresholds, reversible merge/split history, domain verification and approved public business contact enrichment.

### M04 — Website & Digital Presence Intelligence
Linear: ABD-219

Verify domains/sites, classify digital maturity and capabilities, inspect approved technical/business indicators, and run all fetching through SSRF-safe bounded web acquisition.

### M05 — Demand, Intent & Opportunity Signals
Linear: ABD-220

Detect hiring, expansion, RFP/RFQ/tender, vendor requests, support pressure, review pain, multilingual growth, ecommerce/order pressure and other approved explicit/implicit signals with freshness and evidence.

### M06 — BPO Intelligence, Scoring & Explainability
Linear: ABD-221

Map evidence-backed signals to configurable service opportunities and transparent score components: intent, fit, urgency, value, reachability, evidence confidence, freshness and compliance/contactability.

### M07 — Outreach Strategy, CRM & Compliance Controls
Linear: ABD-222

Build decision-maker routing, grounded outreach drafting, human approval, suppression/opt-out, frequency caps, jurisdiction-aware channel rules, CRM state, duplicate prevention and outcome feedback.

### M08 — Dashboard, Search, Workflows & APIs
Linear: ABD-223

Deliver global search, discovery jobs, Business 360, evidence timeline, signals/opportunities, lead queue, outreach review, CRM, connector health, AI quality, compliance administration and provider-agnostic APIs.

### M08A — Desktop & Browser Clients
Linear:
- ABD-227 — Desktop operator application
- ABD-228 — Chrome/Chromium extension
- ABD-229 — Firefox extension
- ABD-230 — Cross-client auth/sync/deep links/capability contracts

Deliver installable clients using shared backend/domain contracts, least-privilege browser permissions, secure desktop storage/deep links, browser-to-desktop handoff, native notifications and cross-client version compatibility.

Detailed plan: `docs/CLIENT_SURFACES.md`.

### M09 — Security, Reliability, Scale & Cost Controls
Linear: ABD-224

Harden ASVS controls, tenant boundaries, SSRF/prompt-injection/tool abuse defenses, supply chain, queue recovery, source failures, load/performance, cost budgets, SLOs, observability, backup/restore and disaster recovery.

### M10 — Beta, Production Readiness & Launch
Linear: ABD-225

Run end-to-end acceptance, AI/data-quality evals, security/adversarial review, compliance review, migration/rollback drills, load/cost validation, production config review, monitoring/runbooks, retention/deletion/suppression verification and controlled go/no-go launch.

### MX — Continuous Product & Market Intelligence
Linear:
- ABD-231 — Specification/evidence contract
- ABD-232 — Future implementation after development approval

Run a governed 24-hour research scout that monitors competitors, APIs/data sources, AI/data techniques, browser/desktop changes, security/privacy policy and UX/commercial patterns. It produces evidence-backed Add / Experiment / Watch / Reject proposals while never auto-coding or auto-merging.

Detailed plan: `docs/CONTINUOUS_MARKET_INTELLIGENCE.md`.

## Technology/UI recommendation for M00 ADR validation
Detailed recommendation: `docs/TECH_STACK_UI.md`.

Current baseline to validate, not yet approved/implemented:
- Web: Next.js App Router + React + TypeScript
- UI: Tailwind CSS 4.x + shadcn/ui/Base UI + Brovexa design tokens
- Desktop: Tauri 2 + Vite/React
- Extensions: WXT + React/TypeScript
- Core backend: NestJS modular monolith
- AI/data workers: Python only where materially justified
- Transactional data: PostgreSQL
- Vector/semantic: pgvector initially
- Queue: Redis + BullMQ initially; Temporal re-evaluation threshold
- Object storage: S3-compatible
- Observability: OpenTelemetry-compatible
- API contracts: OpenAPI/JSON Schema + generated clients
- Monorepo: pnpm workspaces; Turborepo if justified

Do not introduce OpenSearch, Temporal, Kubernetes, microservices or other operational layers without measured requirements/ADR justification.

## Main operator information architecture
Planned primary navigation:
1. Command Center / Today
2. Discover
3. Businesses
4. Business 360
5. Evidence
6. Signals
7. Opportunities
8. Lead Queue
9. Outreach Review
10. CRM / Pipeline
11. Research Jobs
12. Market Intelligence
13. Connectors
14. Compliance / Suppression
15. AI Quality / Evals
16. Usage & Cost
17. Team / Roles
18. Settings

The UI must be evidence-first, keyboard-friendly, accessible, explainable and explicit about confidence/freshness/partial data.

## Data architecture principles
Canonical records distinguish:
- facts
- source evidence
- inference
- verification state
- freshness
- confidence
- source policy
- model/rule/prompt versions

Material entities include Business, BusinessLocation, Domain, ContactChannel, SourceReference, Evidence, Signal, Opportunity, Score, OutreachRecord, SuppressionRecord, ConnectorPolicy, JobRun and AuditEvent.

## AI-native requirements
- LLM outputs use validated structured schemas.
- Web/document content is untrusted data, never instructions.
- Material AI claims require evidence IDs.
- Low-confidence or contradictory results move to review.
- Model/prompt changes require versioned evaluations.
- Deterministic rules are preferred where sufficient.
- AI/search/API costs are budgeted and observable.
- Historical decisions are not silently overwritten.

## Multi-client requirements
- business rules stay canonical in backend/domain modules
- clients share versioned generated contracts
- extension permissions are least-privilege and user-benefit justified
- content scripts never receive reusable backend credentials
- deep links are untrusted navigation input, never authorization
- offline/local cache obeys source/privacy retention rules
- browser runtime differences are isolated and tested
- client releases are signed/provenanced and declare backend compatibility

## Continuous research requirements
- approved/public/authorized sources only
- official/primary sources preferred
- finding includes URL/date/confidence
- compare against prior state and current backlog
- meaningful-delta threshold prevents issue spam
- bounded search/fetch/model/runtime budget
- external content remains untrusted
- no auto-feature implementation or merge
- safe GitHub outputs only

## Compliance requirements
Every connector must declare allowed use, access method, field-level storage/retention, attribution, geographic restrictions, quota/rate limits, refresh/deletion rules, terms/policy version and review owner.

Outreach must enforce jurisdiction/business-type rules, suppression, opt-out/unsubscribe, frequency limits, identity disclosure and applicable lawful-basis/consent records. Initial releases remain human-approval-first.

## Security baseline
- OWASP ASVS 5.0 as the application-security verification baseline appropriate to risk
- NIST SSDF 1.1 for secure development practices
- SLSA 1.2-aligned supply-chain provenance/hardening where practical
- least privilege and tenant isolation
- secure secret management
- SSRF/network egress controls
- prompt-injection/tool-abuse defenses
- dependency/SBOM/vulnerability controls
- auditable privileged operations

## Definition of Ready
A feature is ready only when product behavior, affected source/data policies, architecture/integration impact, security/privacy/compliance implications, acceptance criteria, test strategy, AI evals where relevant, and migration/rollback behavior are sufficiently defined.

Client features additionally require permission/runtime/compatibility contracts. Scheduled research automation additionally requires source registry, output schema, cost budgets, safe outputs and no-spam/dedup behavior.

## Definition of Done
Done requires implementation, appropriate automated tests/evals, required quality/security checks, resilient error handling, data integrity, understood performance/cost implications, observability, documentation/ADRs/checkpoint, meaningful Git history and visible known limitations.

If important items remain incomplete, report PARTIALLY COMPLETE rather than DONE.

## Development authorization
Planning, audits, research, documentation and ADR preparation may proceed.

Feature implementation, GitHub research-workflow enablement and product-code changes begin only after:
1. M00 requirements are internally consistent and accepted
2. ABD-215 is explicitly approved
3. the owner explicitly consents to development after reviewing the current planning artifacts
