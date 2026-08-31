# Brovexa — Reliability, Capacity & Cost Guardrails v1.0

Status: **Planning Only — operational guardrails before implementation**

## Main risk

Brovexa's main scale/cost risk is fan-out across search APIs, source connectors, web fetches, enrichment, AI agents and continuous monitors. Capacity is therefore budgeted per workspace/ResearchJob before horizontal worker scale.

## Cost dimensions

Track source/API requests, search queries, fetches/bytes, enrichment calls, AI provider units/tokens, evaluator calls, object bytes, DB/event volume, WorkUnit count, duration/concurrency, Research Credits and direct estimated cost.

Canonical hierarchy:

`Workspace → ResearchJob → JobRun → WorkUnit → SourceTask/AgentRun → UsageEvent`

Usage events and credit debits are immutable/idempotent ledger entries.

## Preflight limits

Warning + hard limits can cover candidate businesses, pages, API/search calls, model calls/tokens, Research Credits, monetary cost, runtime, concurrency, geography WorkUnits and source quotas.

Agents cannot expand hard limits. An increase creates a new approved JobVersion/preflight.

## Early stop

Stop/reduce depth on hard-budget reach, low marginal yield, coverage completion, excessive duplicates, low source quality, policy expiry, cost variance or user cancel/pause.

## Fair scheduling

Per-workspace, per-source and global concurrency/rate budgets. Suggested priority: interactive action → user research → scheduled Lead refresh → continuous monitors → Market Scout → maintenance/backfill.

Priority never bypasses provider limits/policy/budget.

## Backpressure

On DB/Redis/provider/model degradation: reduce concurrency, pause low-priority queues, delay scheduled work, preserve interactive capacity, expose degraded/partial state and avoid uncontrolled retries.

## Reliability planning objectives

- no loss of acknowledged canonical writes from a worker/process failure
- ResearchJobs recover after worker/Redis restart from PostgreSQL canonical state
- provider partial outage degrades affected source rather than corrupting whole job
- hard spend-limit bypass: zero tolerance
- tenant isolation breach: zero tolerance
- API availability planning target >=99.9% after production maturity, not a launch promise

## Kill switches

Server-authoritative, audited controls for connector, source class, model/provider, agent definition, outreach, client minimum version, workspace/global spend, Market Scout and webhook integration.

## Capacity/benchmark requirements

Benchmark API throughput, planner throughput, WorkUnit lifecycle, queue delay, entity resolution, evidence/signal writes, Business filters, Lead Inbox, memory/context retrieval, per-source workers and AI latency/cost.

No invented scale claims; synthetic/demo baselines are updated from beta measurements.

## Retention cost

Retention classes decide transient/reference/minimal-evidence/source-content storage. Expiry jobs purge content/derived indexes according to policy while preserving only lawful/required audit lineage.

## Preflight estimation

When uncertain return low/expected/high estimate plus confidence, assumptions and coverage gaps. Actual-vs-estimated usage becomes calibration data.

## Production acceptance

Representative benchmarks; hard-budget bypass tests; queue/DB backpressure; provider rate-limit/outage tests; ledger idempotency/concurrency; no double debit after restore/replay; anomaly dashboards/alerts; measured unit cost for top expensive operations.

Package Research Credit allowances are not finalized until representative provider/model costs exist.