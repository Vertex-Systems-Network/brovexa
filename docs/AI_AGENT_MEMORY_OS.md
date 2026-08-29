# Brovexa AI Agent OS & Durable Memory Architecture

Status: **Planning Only — no implementation authorization**

Linear: ABD-241, ABD-244, ABD-212, ABD-213, ABD-214, ABD-215.

## Core rule

Brovexa is not an app that occasionally calls an LLM. AI agents are governed platform components. Models reason; durable platform state remembers; deterministic services enforce permissions/policy; evidence supports claims.

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

- Working/run: plan, work units, intermediate structured state and checkpoints for one job/run.
- Semantic: durable workspace/user preferences, verified facts and stable configuration.
- Episodic: prior runs, decisions, corrections, outcomes and interactions.
- Procedural: approved playbooks, policies, service mappings and agent skills.
- Entity: longitudinal Business/Location/Domain/Contact history.
- Lead: qualification, score, ownership, stage, research gaps, tasks and outcomes.
- Research: attempted queries, source coverage, prior findings, cost and last-researched timestamps.
- Workspace/user: ICP, service catalog, countries, exclusions, language/brand voice, saved job templates and approval defaults.

Memory is not a raw chat dump.

## MemoryRecord

Store namespace/scope, type/subtype, subject/entity refs, structured content, provenance/evidence refs, writer, model/prompt/tool versions for AI-derived records, confidence/authority, created/updated/observed/verified timestamps, validity interval, active/superseded/stale/conflicted/deleted status, retention/expiry, ACL, version parent and data classification.

Verified facts and AI memory remain distinct. Contradictions create explicit conflicts; old records are superseded rather than overwritten.

## Context retrieval

Context Builder considers task/entity scope, policy authority, semantic relevance, recency, confidence, source authority, user importance, conflict state and token budget. Vector similarity alone is not enough.

Priority: mandatory policy/permissions → current job state → exact entity/lead facts/evidence → relevant memories → optional history.

## Long-running work

Model context is never authoritative job state. Persist plans/work units/checkpoints so a new model/process can resume. High-impact work uses generation and independent evaluation rather than self-review alone.

## Autonomy tiers

T0 Explain/read only; T1 Suggest/draft; T2 reversible internal action within approved contract; T3 external/reversible action only under explicit workspace policy; T4 high-impact/irreversible action requires human approval. Suppression overrides, ambiguous merges and unrestricted autonomous bulk outreach are not default agent powers.

## UI

AI Command/Ask Brovexa; Agent Center; Run Trace; Memory Inspector; Agent settings; Review Queue for low confidence, contradictions, evaluator disagreement and policy blocks.

## Security/evals

Test prompt injection, malicious memory, cross-tenant leakage, secret/tool escalation, forged evidence, runaway fan-out, stale/conflicting memory and evaluator disagreement. Measure grounding, task quality, signal/entity metrics, policy compliance, injection resistance, memory usefulness/staleness, latency and cost.

## Gate

Architecture/framework/model/vector/orchestrator choices require ADR approval. Implementation waits for ABD-241, ABD-215 and explicit owner development consent.