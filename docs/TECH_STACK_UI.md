# Brovexa Technology Stack & UI Architecture Recommendation

Status: **M00 recommendation — not implementation authorization**

Linear: ABD-233, ABD-226, ABD-215.

## Goals
Optimize for:
- fast iteration
- strong shared contracts across Web/Desktop/Extensions
- Windows-friendly development
- reliable async research/enrichment
- AI/data capability without forcing the whole backend into Python
- secure self-hosted/internal beta usability
- straightforward cloud scale path
- low premature infrastructure complexity

## Recommended baseline

### Web
**Next.js App Router + React + TypeScript**

Supporting UI:
- Tailwind CSS 4.x
- shadcn/ui with Base UI for new project
- Brovexa design tokens
- TanStack Table for dense data tables
- schema-first forms/validation
- chart library selected by dashboard needs
- MapLibre + approved/licensed tile source if map visualization is needed

### Desktop
**Tauri 2 + Vite + React + TypeScript**

Reuse shared UI/domain/API packages. Do not embed the full Next.js server runtime in desktop.

Tauri is preferred because Brovexa initially needs a secure native shell, deep links, local storage, notifications and updates—not a bundled full Chromium automation runtime.

Electron remains a fallback only if real capability testing proves Tauri/WebView unsuitable.

### Extensions
**WXT + React + TypeScript**

One source codebase targets Chrome/Chromium and Firefox with explicit runtime adapters.

WXT is attractive because it provides cross-browser builds and normalized extension API access. Browser differences still require tests; they must not be hidden behind assumptions.

### Core backend/API
**NestJS + TypeScript modular monolith** initially.

Proposed modules:
- Identity/Tenants
- Users/Roles
- Businesses/Locations
- Contacts
- Sources/Connector Policies
- Evidence
- Signals
- Opportunities
- Scoring
- Research Jobs
- Outreach Review
- CRM
- Suppression/Compliance
- Audit
- Usage/Cost
- Notifications

Why modular monolith first:
- simpler deployment/debugging
- strong internal boundaries
- avoids premature service sprawl
- individual heavy modules can be extracted later when measurements justify it

### Python
Introduce Python workers/services only when Python has a concrete ecosystem advantage, such as specialized extraction/NLP, calibration/data-science or ML/evaluation work.

Simple LLM calls should not automatically create a Python service boundary.

### Database
**PostgreSQL** as canonical transactional store.

Canonical data includes tenants/users, businesses/locations, evidence metadata, signals/opportunities/scores, job state, audit state, compliance/suppression and CRM state.

### Semantic/vector search
**pgvector first**.

Use HNSW/IVFFlat as appropriate after measuring the data/query workload.

Evaluate **OpenSearch** only when Brovexa proves a need for large independent faceted/hybrid search, horizontal search scaling or specialized relevance pipelines.

### Queue/orchestration

#### Option A — Redis + BullMQ — Recommended v1
Appropriate for connector/enrichment queues, delays, priorities, retries and worker scaling. Keep canonical JobRun/checkpoint/idempotency state in PostgreSQL.

Pros:
- simple local environment
- strong NestJS fit
- low operational cost

#### Option B — Temporal
Excellent for long-running durable workflows that must resume across failures and complex multi-stage orchestration.

Trade-off: more infrastructure/operational concepts.

Recommendation: start BullMQ + explicit durable PostgreSQL job state; re-evaluate Temporal when real orchestration complexity demonstrates the need.

### Cache/ephemeral state
**Redis** for queues, bounded cache where provider policy permits, rate-limit counters and short-lived coordination/locks.

No canonical fact/evidence exists only in Redis.

### Object/evidence storage
**S3-compatible API**.

Local/dev: MinIO or equivalent.
Production: managed S3-compatible service.

Raw/snapshot evidence is stored only when source-policy/retention rules allow it.

### Contracts
- OpenAPI
- JSON Schema
- generated TypeScript clients/types
- versioned schemas for AI structured outputs

### Monorepo
Recommended:
- pnpm workspaces
- Turborepo if task graph/cache justifies it

Suggested structure:

```text
apps/
  web/
  api/
  desktop/
  extension/
  worker-ai/        # only if justified
packages/
  ui/
  domain/
  api-client/
  schemas/
  config/
  telemetry/
  testing/
```

## Authentication options
Use OIDC/OAuth-compatible architecture rather than custom ad-hoc auth.

### Managed IdP
Fastest launch, MFA/enterprise features, recurring vendor cost/dependency.

### Self-hosted IdP
More control/self-hosting, more operational/admin overhead.

### Application-owned auth library
Fast integration but greater Brovexa security ownership.

Recommendation: select an OIDC-first provider during M00 based on whether first launch is internal/self-hosted or public SaaS. Desktop/extensions must use browser/device-safe OAuth flows and short-lived tokens.

## Observability
Prefer OpenTelemetry-compatible instrumentation.

Track:
- source latency/errors/rate limits/cost
- queue depth/age/retries
- entity match review rate
- signal/eval quality
- AI token/cost/latency
- suppression/compliance actions
- client versions/health

## Local development / internal beta
Brovexa must run locally without Kubernetes.

Recommended:
- Docker Compose for PostgreSQL, Redis, object storage and optional observability
- Node/pnpm apps run natively or in containers
- one-command infra startup
- one-command development startup
- seeded demo workspace
- sandbox/mock connectors so UI can run without paid API credentials

An internal beta can use a simple container deployment on one capable server or managed container environment. Introduce Kubernetes only when real scale/availability needs justify it.

## Testing

### TypeScript
- Vitest/Jest by framework fit
- API integration testing
- Playwright Web E2E

### Extensions
- Playwright Chromium + Firefox
- permission/background/content lifecycle tests
- malicious page/prompt-injection tests

### Desktop
- shared React/domain unit tests
- Rust/native-command unit tests
- packaged Windows smoke/E2E

### Python
- pytest
- shared schema contract tests

### AI/data quality
- versioned golden datasets
- schema validation
- regression gates

## UI direction
Brovexa should feel like an **intelligence operations console**, not a generic CRM template.

Attributes:
- dense but calm
- evidence-first
- high information hierarchy
- keyboard-friendly
- explainable scores
- visible confidence/freshness
- dark/light themes
- desktop-first responsive behavior

Visual system:
- neutral graphite/slate base
- one Brovexa accent
- semantic colors reserved for status/risk/confidence
- tabular numerals for scores/costs
- compact cards/data grids/split panes
- minimal decorative effects

## Main information architecture

### Command Center / Today
- new high-priority opportunities
- jobs completed/failed
- review queue
- stale leads
- source health
- budget alerts
- recommended next actions

### Discover
- country/region/city
- niche/sub-niche
- source plan
- filters
- record/budget limit
- depth/run mode
- estimated cost/coverage before execution

### Businesses
Dense table with:
- name
- geography/category
- website status
- contactability
- latest signal
- top opportunity
- score/confidence
- freshness

Saved views and safety-limited bulk actions.

### Business 360
Suggested layout:
- header: identity/location/category/status/score
- center: canonical facts + digital presence + signals/opportunities
- right inspector: evidence/confidence/source freshness
- timeline: observed events/research history
- actions: refresh/add lead/request review/outreach strategy

### Evidence
- source
- structured claim/excerpt
- timestamp
- source-policy state
- confidence
- linked facts/signals/opportunities
- contradiction flags

### Signals
Hiring, expansion, RFP/tender, support pain, multilingual growth, ecommerce pressure and configurable approved signals.

### Opportunities
- service recommendation
- why
- evidence
- urgency/fit
- estimated value band
- confidence
- contraindications

### Lead Queue
- priority
- owner/stage
- next action
- contact route
- compliance state
- refresh/staleness indicator

### Outreach Review
Three-pane model:
- evidence/opportunity
- generated draft
- policy/contactability checklist

### CRM / Pipeline
Stages, notes, tasks, outcomes and follow-up.

### Research Jobs
- scope/stage
- coverage
- connector breakdown
- cost
- retry/failure state
- pause/cancel/re-run

### Market Intelligence
Daily scout output:
- competitor deltas
- new APIs/sources
- product proposals
- Add/Experiment/Watch/Reject
- review history

### Connectors
- enabled state
- policy version
- health
- quota/cost
- last success
- retention rule

### Compliance / Suppression
- jurisdiction policy
- contactability decisions
- suppression/opt-out
- retention/deletion
- audit history

### AI Quality / Evals
- model/prompt versions
- eval scores/regressions
- hallucination/grounding metrics
- cost/latency

### Usage & Cost
By provider, workspace and job with budgets/alerts.

### Team / Roles
RBAC, audit and workspace membership.

## Extension UI states
1. No supported business/page
2. Possible entity match
3. Confirmed business
4. Evidence candidate
5. Research running
6. Opportunity summary
7. Permission/compliance warning
8. Error/retry

Deep analysis belongs in Web/Desktop; the extension stays focused.

## Accessibility/client-friendly rules
- full keyboard navigation
- visible focus
- semantic status text, not color-only
- accessible tables/dialogs
- reduced motion/high contrast
- meaningful score/confidence labels
- explicit loading/error/empty/partial states
- configurable density/theme

## Initial deployment topology
```text
Web / Desktop / Extensions
          |
       API Layer
          |
  Modular NestJS Backend
      /      |       \
Postgres   Redis    Object Storage
             |
           Workers
```

Do not start with microservice sprawl or Kubernetes.

## Required ADRs
1. Web framework
2. Tauri vs Electron fallback
3. WXT vs extension alternatives
4. Backend framework
5. identity provider/model
6. PostgreSQL ownership/schema boundaries
7. BullMQ vs Temporal trigger threshold
8. pgvector vs OpenSearch trigger threshold
9. object storage/retention
10. monorepo/build tooling
11. deployment topology
12. observability stack
13. map/tiles provider
14. AI/search provider abstraction

## Current recommendation
**Next.js + React + TypeScript / Tailwind 4 + shadcn Base UI / NestJS modular monolith / PostgreSQL + pgvector / Redis + BullMQ / Tauri 2 / WXT / S3-compatible storage / OpenTelemetry / pnpm monorepo.**

Python only where a specific AI/data workload justifies it.

## Research references
- Next.js App Router: https://nextjs.org/docs/app
- React versions: https://react.dev/versions
- Tailwind CSS: https://tailwindcss.com/blog
- shadcn/ui: https://ui.shadcn.com/docs
- Tauri 2: https://v2.tauri.app/start/
- WXT: https://wxt.dev/
- NestJS queues: https://docs.nestjs.com/techniques/queues
- Temporal: https://docs.temporal.io/
- PostgreSQL: https://www.postgresql.org/docs/
- pgvector: https://github.com/pgvector/pgvector
- OpenSearch hybrid search: https://docs.opensearch.org/latest/vector-search/ai-search/hybrid-search/index/

## Authorization
Final selection requires M00 ADR validation and owner consent before implementation.