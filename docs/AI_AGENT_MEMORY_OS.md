# Brovexa AI Agent OS & Durable Memory Architecture

Status: **Planning Only — no implementation authorization**

Linear: ABD-241, ABD-244, ABD-212, ABD-213, ABD-214, ABD-215.

## Core rule
Brovexa is not an app that occasionally calls an LLM. AI agents are governed platform components. **Models reason; durable platform state remembers; deterministic services enforce permissions/policy; evidence supports claims.**

Model/chat context is transient compute input. It is never the authoritative job state, user memory, business truth or policy store.

## Runtime pattern
Trigger (user/schedule/event) → Orchestrator → Context Builder → bounded plan → parallel specialist agents → deterministic validators → Evidence Verifier → independent Evaluator/Critic → canonical state update → Memory Curator/checkpoint → user-visible result/action proposal.

Parallelism is bounded by task, cost, quota and policy. Do not spawn agents merely to appear AI-native.

## AgentDefinition
Each agent is versioned with: purpose/non-goals, trigger types, input/output schemas, allowed tools, memory read/write namespaces, model/provider policy, prompt/skill versions, token/search/API/cost/runtime/concurrency budgets, confidence/review thresholds, deterministic validators, fallback, eval suite, security risk and owner/change history.

## Planned logical agents
Control: Orchestrator/Planner, Context Builder, Evidence Verifier, Independent Evaluator, Compliance Guardian, Security Critic, Cost/Quota Optimizer, Memory Curator.

Intelligence: Geo Planner, Source Planner, Business Discovery, Entity Resolution, Contact Enrichment, Website Analyst, Signal Hunter, News/Event, Procurement/Tender, Hiring/Workforce, Technology, Reputation/CX, BPO/Service Opportunity Strategist, Lead Qualifier, Lead Scorer, Buying-Committee Mapper, Lead Router, Next-Best-Action, Outreach Drafting, Market Scout and Data Quality.

Initial implementation may combine roles when separation has no measurable quality/security benefit.

## Durable memory types
- **Working/run** — plan, work units, intermediate structured state and checkpoints for one job/run.
- **Semantic** — durable workspace/user preferences and stable learned knowledge; verified business facts themselves remain canonical FactObservations, while memory can reference/summarize them.
- **Episodic** — prior runs, decisions, corrections, outcomes and interactions.
- **Procedural** — approved playbooks, policies, service mappings and agent skills.
- **Entity** — longitudinal Business/Location/Domain/Contact context built from canonical history.
- **Lead** — qualification, score, ownership, stage, research gaps, tasks and outcomes.
- **Research** — attempted queries, source coverage, prior findings, cost and last-researched timestamps.
- **Workspace/user** — ICP, service catalog, countries, exclusions, language/brand voice, saved job templates and approval defaults.

Memory is not a raw chat transcript dump and does not replace canonical facts, events or audit records.

## Memory namespaces
A memory key is explicitly scoped, for example:
- `system/procedural/<policy-or-playbook>`
- `workspace/<workspaceId>/preference/<key>`
- `workspace/<workspaceId>/research/<scope>`
- `workspace/<workspaceId>/business/<businessId>`
- `workspace/<workspaceId>/lead/<leadId>`
- `user/<userId>/workspace/<workspaceId>/preference/<key>`
- `run/<researchRunId>/<subtype>`

Cross-workspace retrieval is denied by default. System procedural memory is signed/versioned/read-only to normal agents. User-specific preference memory does not silently become workspace policy.

## MemoryRecord
Canonical fields:
- id/version/revision parent
- namespace + workspace/user/run/entity/lead scope
- memory type/subtype
- subject refs
- structured content schema/version
- provenance: evidence/fact/activity/run/user-decision refs
- writer: user/agent/system/curator
- model/prompt/tool/agent versions when AI-derived
- confidence and authority class
- createdAt/updatedAt/observedAt/lastVerifiedAt
- validFrom/validTo/refreshAfter/expiresAt
- status: Proposed / Active / Stale / Conflicted / Superseded / Rejected / Deleted
- retention policy + deletion reason
- ACL/read-write capability
- data classification/sensitivity
- source-policy/jurisdiction references when required

An embedding/index representation is a derived `MemoryIndexRef`; deleting/superseding canonical memory invalidates/rebuilds it.

## Memory authority classes
From strongest to weakest for retrieval/decision use:
1. platform policy / approved procedural rule
2. explicit current user/workspace configuration
3. verified canonical fact/evidence reference
4. reviewed human decision/correction
5. high-confidence evaluated agent conclusion
6. ordinary agent summary/inference
7. historical/low-confidence/stale context

Lower-authority memory cannot silently override higher-authority policy/config/facts.

## Memory creation/promotion pipeline
Not every agent output becomes memory.

`Candidate insight → schema validate → classify memory type/sensitivity → attach provenance → authority/confidence check → policy/retention check → conflict lookup → deterministic validation or human/evaluator review when required → commit Active memory → index asynchronously`.

Examples:
- user says “we do not serve gambling businesses” → explicit workspace preference/policy candidate; requires permission and may map to a formal exclusion setting.
- agent discovers business changed location → canonical FactObservation first; entity memory may summarize/reference it only after verification.
- agent finds a failed query strategy → Research memory may persist immediately if non-sensitive/reversible and scoped to the run/workspace.
- model invents a conclusion with no evidence → never promoted as factual memory.

## Write permissions
Agents receive explicit memory capabilities:
- `memory.read(namespace-pattern)`
- `memory.propose(namespace-pattern)`
- `memory.commit` only for low-risk allowed memory classes
- `memory.supersede` only within permitted classes
- no agent gets unrestricted delete/system-procedure mutation

High-impact procedural/policy memories and cross-workspace/global knowledge updates require governed publication, not direct agent writes.

## Conflict/staleness model
Do not overwrite old memory silently.

`MemoryConflict` links competing records and classifies conflict type: factual contradiction, preference change, source disagreement, temporal replacement or policy-version conflict.

Resolution may:
- supersede an older record
- retain both with context/time ranges
- lower authority/confidence
- trigger re-research/human review
- mark unresolved and exclude from high-impact decisions

Freshness is memory-type-specific. A user's brand tone may remain stable for months; employee/contact/title or research coverage may stale quickly.

## Context Builder contract
Input: task, workspace/user, target entities/leads/job, agent definition, policy context and token/cost budget.

Context retrieval stages:
1. **Hard mandatory context** — auth/permissions, source/jurisdiction policy, job budget/contract, system rules.
2. **Exact canonical context** — current job/Lead/Business facts/evidence/state required for the task.
3. **Scoped memory candidates** — namespace/filter by entity/user/workspace/type.
4. **Hybrid rank** — authority + relevance + freshness + confidence + task specificity + user pin + contradiction penalty + semantic similarity.
5. **Diversity/dedup** — avoid five summaries of the same source/episode.
6. **Token/cost pack** — structured compact representation with provenance IDs.
7. **Context receipt** — record which memory/fact/policy versions were supplied to the agent for later reproducibility/evals.

Vector similarity is one ranking input, never the authority model.

## Context isolation
- An agent receives only minimum necessary workspace/user/entity context.
- Outreach Drafting does not receive unrelated workspace secrets.
- Market Scout does not receive customer PII unless explicitly required/authorized.
- Evaluator should receive enough independent evidence to judge output but need not mirror the generator's full reasoning context.
- Tool results from untrusted web content are labelled untrusted and cannot modify system/procedural memory directly.

## Working memory and durable checkpoints
Working memory is structured state, not an ever-growing text transcript:
- current objective and compiled plan
- completed/pending WorkUnits
- exact artifact IDs/results
- unresolved questions/conflicts
- budget/cost state
- retry/circuit-breaker state
- next executable steps

Checkpoint commits are idempotent/versioned. A new process/model can restore from the latest valid checkpoint and verify already-completed effects before retrying.

## Research memory
Purpose: prevent duplicate cost and improve future plans without hiding freshness.

Examples:
- queries attempted + normalized intent
- source/geo/category coverage
- zero-result or low-quality source history
- source quality/cost yield
- last researched/refresh-after
- successful query patterns

A prior `no result` is not a permanent fact; expiry/freshness controls whether the planner may skip or should retry.

## Entity memory
Entity memory is a longitudinal **context layer over canonical facts/evidence**, not a parallel business database. It may contain summaries such as “three support-hiring observations appeared since June”, but each summary references canonical Signal/Fact IDs and can be rebuilt.

## Lead memory
Lead memory captures why commercial state evolved:
- creation reason/opportunity IDs
- qualification decisions and user corrections
- score-change explanations
- buying-committee gaps
- prior next-best actions accepted/rejected
- research attempts
- stage/tasks/outcomes
- nurture/reactivation reasons

Lead state itself remains canonical Lead/Activity/Score data; memory accelerates context and learning.

## User/workspace preference memory
Explicit preference capture has an approval/visibility model:
- `ExplicitSetting` — user intentionally sets/configures it; authoritative within scope.
- `LearnedPreferenceCandidate` — inferred from repeated behavior; shown/reviewable before affecting important automation.
- `TemporarySessionPreference` — expires automatically.

A single rejected recommendation does not silently become a permanent global rule.

## Memory deletion/forget controls
Authorized users/admins can inspect and delete/correct memory within policy. Deletion workflow:
`authorize → assess legal/source/audit retention → tombstone/delete canonical memory → remove/rebuild derived indexes/caches → invalidate context caches → propagate to backups/retention workflow as applicable → audit`.

Deletion of memory does not falsify immutable required audit/domain events; instead the system removes/anonymizes content according to retention rules while preserving permitted audit evidence.

## Memory poisoning defenses
- external content never writes memory directly
- every AI-derived memory stores provenance/model/prompt/agent version
- executable procedural memory requires signed/governed publication
- malicious instructions in Evidence are data, not directives
- conflicts/authority ranking prevent low-quality source text from overriding policy
- red-team evals include poisoned webpages, poisoned CRM imports, malicious user-uploaded notes and cross-tenant retrieval attempts
- suspicious memory may be quarantined from retrieval pending review

## Long-running work
Model context is never authoritative job state. Persist plans/work units/checkpoints so another model/process/version can resume. High-impact work uses generation and independent evaluation rather than self-review alone.

## Autonomy tiers
T0 Explain/read only; T1 Suggest/draft; T2 reversible internal action within approved contract; T3 external/reversible action only under explicit workspace policy; T4 high-impact/irreversible action requires human approval. Suppression overrides, ambiguous merges and unrestricted autonomous bulk outreach are not default agent powers.

## UI
- AI Command / Ask Brovexa
- Agent Center: active/recent runs, role, stage, cost, tools, sources, confidence
- Run Trace: plan → agents → tool calls → evidence → evaluator → result
- Memory Inspector: namespace/type/source/status/freshness/authority; correct/pin/supersede/delete where authorized
- Context Inspector for privileged debug: what facts/memories/policies were supplied to an agent
- Agent settings: model policy, autonomy, budgets, source limits
- Review Queue: low confidence, conflicts, evaluator disagreement, policy/memory quarantine

## Security/evals
Test prompt injection, malicious memory, cross-tenant leakage, secret/tool escalation, forged evidence, runaway fan-out, stale/conflicting memory and evaluator disagreement.

Memory-specific metrics:
- retrieval precision/usefulness
- stale-memory decision error rate
- contradiction detection recall
- source/provenance completeness
- cross-tenant leakage = zero tolerance
- inappropriate memory promotion rate
- deletion/index-propagation correctness
- token/cost overhead
- answer quality delta with/without retrieved memory

## Gate
Architecture/framework/model/vector/orchestrator choices require ADR approval. Implementation waits for ABD-241, ABD-215 and explicit owner development consent.