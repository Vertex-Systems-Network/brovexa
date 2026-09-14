# Brovexa 24-Hour Continuous Market Intelligence Plan

Status: **Planning Only — no workflow has been implemented or enabled**

Linear: ABD-231 (specification), ABD-232 (future implementation).

## Goal
Run a governed GitHub-native research scout once every 24 hours to answer:

> What materially changed in competitors, APIs, AI/data techniques, browser/desktop platforms, security/privacy requirements, UX patterns or market expectations that could make Brovexa more useful, safer, easier to use, cheaper or more competitive?

The scout proposes. It never silently implements.

## Research domains

### Competitors and adjacent systems
Track products in categories such as:
- sales intelligence
- company/contact enrichment
- intent/signals
- AI prospecting agents
- CRM/outreach automation
- business discovery
- BPO lead generation/marketplaces

Initial named references include Apollo, Clay, HubSpot Sales/Prospecting agents, Crunchbase, ZoomInfo and comparable systems.

Normalize capability dimensions:
- company discovery
- people/contact discovery
- enrichment/provider waterfall
- AI/web research
- buying intent/custom signals
- scoring
- evidence/explainability
- workflows
- outreach/sequences
- CRM
- browser extension
- desktop client
- collaboration
- API/integrations
- compliance/suppression
- usage/cost transparency
- unique differentiator

### Customer pain/workflow friction
Use permitted public sources to identify repeated pain, not isolated anecdotes:
- stale/incorrect data
- false positives
- weak evidence
- difficult onboarding
- high credits/cost
- weak browser support
- opaque scoring
- CRM sync friction
- repetitive research work

### New or changed data sources
Research official registries, open datasets, search APIs, job/tender/news/review sources, domain/contact verification, geospatial/business discovery and other authorized providers.

Each source proposal must state access method, license/terms, storage/cache/retention constraints, geography, quota, cost and reliability.

### AI/data engineering
Track production-relevant improvements in structured outputs, tool calling, search/RAG, entity resolution, ranking/calibration, multilingual extraction, prompt-injection defense, agent evals and cost/latency.

### Browser/Desktop
Track Chrome Manifest/API/store policy, Firefox WebExtensions changes, WXT compatibility, Tauri security/updater behavior, and platform packaging changes.

### Security/privacy/compliance
Track relevant OWASP, NIST, supply-chain and direct-marketing/privacy/source-policy changes. The scout never performs automated legal sign-off.

### UX/commercial positioning
Research workflow design, account prioritization, explainable scoring, AI-assistant patterns, onboarding, trial/credit/usage models and collaboration.

## Source hierarchy
1. Official product/API/framework/security/regulatory documentation
2. Official changelogs/release notes
3. Primary announcements
4. Public community/review sentiment for pain signals
5. Secondary sources only when primary evidence is unavailable

Every finding records URL, source type, publication/update date, retrieval date and confidence.

## Daily pipeline
1. Load product plan, backlog index, previous competitor state, source registry and run budget.
2. Plan bounded fixed + change-focused + rotating deep-dive queries.
3. Acquire evidence from approved search/API/fetch connectors.
4. Normalize findings into product/capability/old-state/new-state/evidence/date.
5. Verify material claims and flag contradictions.
6. Compare against current Brovexa plan/implementation/backlog.
7. Generate proposal candidates with user problem, use case, benefit, complexity, risk, cost and dependencies.
8. Deduplicate against GitHub/Linear and prior rejected/watch items.
9. Classify: **ADD / EXPERIMENT / WATCH / REJECT**.
10. Publish safe output only when there is meaningful delta.

## Meaningful-delta rule
A new proposal requires at least one material condition:
- competitor capability overlaps a strategic Brovexa gap
- repeated customer pain creates a strong opportunity
- new authorized API/source unlocks planned capability
- platform/provider/security policy change creates risk
- cost/performance change can materially improve operations
- planned Brovexa capability has become obsolete or materially improvable

Cosmetic/marketing wording changes and duplicate news are ignored.

## Proposal scoring
Use an explainable component score, e.g.:

`Priority = User Value × Strategic Fit × Evidence Confidence × Differentiation × Urgency / (Complexity × Risk × Cost)`

Store components rather than only the final number.

Suggested dimensions (0–5):
- user value/frequency
- business/revenue impact
- differentiation
- evidence confidence
- urgency
- complexity
- operating cost
- security/compliance risk
- architecture disruption

## GitHub schedule design
Recommended: once daily at an off-hour minute such as **08:17 Asia/Karachi** (equivalent cron validated at implementation).

GitHub scheduled workflows:
- execute from the default branch
- may be delayed during high load
- are more likely to be delayed around the start of an hour

Therefore do not schedule at `:00`.

Triggers after approval:
- `schedule` once daily
- `workflow_dispatch` manual dry-run/re-run

Concurrency:
- one research run at a time
- overlapping runs cannot create duplicate proposals

## Implementation options

### Option A — Deterministic GitHub Action + Brovexa research runner — Recommended
A versioned CLI/service performs search, fetch, normalization, structured LLM reasoning, validation, deduplication and GitHub safe outputs.

Pros:
- testable schemas
- exact provider/cost controls
- explicit source allowlist
- stable regression behavior
- not dependent on preview workflow semantics

Cons:
- more implementation work

### Option B — GitHub Agentic Workflow — Experimental
GitHub Agentic Workflows can define AI-powered repo automations in Markdown with declared permissions/safe outputs and compile them into Actions workflows.

Current status: **public preview**. Supported engines include coding-agent options documented by GitHub.

Pros:
- fast natural-language workflow authoring
- GitHub-oriented safe outputs/human review

Risks:
- preview surface can change
- still needs robust current-web evidence and source-policy design
- agent credentials/billing/configuration required

Recommendation: evaluate as an adapter/experiment, not the sole foundation.

### Option C — Brovexa-hosted scheduler later
Move orchestration into Brovexa infrastructure when production connector/search infrastructure exists, while GitHub remains a review/report destination.

## Research provider abstraction
Do not hard-code one vendor.

Contracts:
- SearchProvider
- Fetch/ExtractionProvider
- ReasoningProvider
- StructuredDataProvider (optional)

Each provider exposes config, allowed source classes, budget, retry/rate limits, cost, timeout, provenance and health.

## Safe GitHub outputs
Default token posture should be read-only except explicitly approved writes.

Allowed candidates:
- update one rolling research issue
- create a proposal issue only for high-quality meaningful delta
- upload report artifact
- optionally update a dedicated `research-state` branch

Never:
- auto-merge PRs
- modify product code
- enable connectors
- change release/security settings
- expose secrets
- mark implementation Done

## Research state options

### A. Actions artifacts only
Simple, but retention/long-term comparison is weaker.

### B. Dedicated `research-state` branch — Recommended early
Store compact normalized state and evidence references, not raw scraped corpora. Keep main clean and preserve diffs/history.

### C. Brovexa database — Long-term
Best once backend exists.

## Output schema
Each run includes:

### Run
- timestamp/status
- workflow/commit/version
- sources attempted/succeeded/failed
- provider/model versions
- search/API/LLM usage and cost

### Finding
- tracked entity/product
- capability category
- observed change
- evidence URL/date
- confidence
- Brovexa relevance

### Proposal
- title/problem
- target user/persona
- use case
- evidence
- proposed capability
- why now
- expected benefit
- architecture/security/compliance/cost impact
- dependencies
- classification
- next review action

## Failure behavior
- search outage → partial run, no fabricated findings
- blocked/rate-limited source → record coverage gap
- reasoning model failure → retain evidence but do not publish unsupported synthesis
- budget exhaustion → stop gracefully and report incomplete coverage
- contradictory evidence → WATCH/REVIEW
- missing prior baseline → establish baseline; do not call findings “new”

## Security
- all external content is untrusted data
- fetched content cannot change workflow permissions/instructions
- secrets stay outside model context
- least-privilege GitHub permissions
- pin/review trusted Actions dependencies according to supply-chain policy
- validate all structured output before any write action
- bounded source/network allowlist

## Cost controls
Hard per-run limits:
- search queries
- pages fetched
- bytes processed
- LLM calls/tokens
- provider monetary cost
- total runtime

Budget anomaly stops the run.

## Initial market observations
Current public product materials show that:
- Apollo combines AI research, lead scoring, workflows and an extension embedded in existing sales workflows.
- Clay emphasizes multi-provider enrichment and custom signals.
- HubSpot prospecting agents research accounts and monitor buying signals.
- Crunchbase exposes forward-looking company/growth intelligence.

Brovexa should differentiate with evidence-backed **business need → BPO/service opportunity → explainable recommended action**, plus source-policy/provenance/compliance controls.

## Official research references
- GitHub scheduled workflows: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- GitHub scheduling delays: https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- GitHub token permissions: https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
- GitHub Agentic Workflows: https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows

## Authorization
ABD-232 remains blocked until ABD-231 is accepted, ABD-215 is approved, and the owner explicitly authorizes development.