# Brovexa — AI Agent Contracts, Model Routing & Evaluation Matrix

Status: **Planning Only**

## Common AgentDefinition
Stable key/version; purpose/non-goals; trigger; input/output JSON Schemas; tool/action schemas; SourceCapability/Policy classes; memory read/propose/commit scopes; allowed canonical commands; autonomy tier; human interrupts; model/provider policy; prompt/skill/context versions; retry/fallback; token/search/API/credit/currency/runtime/concurrency budgets; validators; evidence requirements; confidence/review thresholds; independent evaluator; eval suite/threshold; data classification/telemetry/redaction; owner/change/rollback.

Agents receive server-side commands, never raw DB/credential authority.

## AgentRun envelope
Agent/version, run/parent/handoff, model/provider, prompt/skill/ContextReceipt, structured result, confidence/uncertainty, evidence/fact/source IDs, assumptions/conflicts, tool/cost summary, validation/evaluator state and proposed canonical actions. Model text never proves a mutation succeeded.

## Model routing
Choose task-policy model from risk, structured output/tools, context, language, latency, historical eval quality, data/provider policy, cost and availability. Fallback must itself be approved; sensitive work cannot silently move to an unapproved provider. Deterministic code wins where sufficient.

## Logical agent matrix

### `agent.control.orchestrator`
Compiles approved user/ResearchJob scope into bounded DAG/WorkUnits. T2 internal only. Cannot broaden source/geo/purpose/budget. Evals: decomposition, missing tasks, unnecessary fan-out, zero policy/budget breach.

### `agent.control.context`
Minimum necessary context + persisted ContextReceipt. T0. Evals: relevance/freshness/conflict handling; zero cross-tenant leakage.

### `agent.research.geo`
Resolves text geography to canonical GeoAreas. Ambiguity goes to preflight/review. Evals: hierarchy/disambiguation/include-exclude/radius/polygon.

### `agent.research.source_planner`
Chooses connectors by capability/policy/quality/cost/freshness. Cannot select unapproved source. Evals: select/skip reasons, yield, zero policy violations.

### `agent.research.discovery`
Finds Business/Location candidates. Writes candidates/source refs, not verified facts. Evals: precision/coverage/duplicate/geo-niche adherence.

### `agent.intel.entity_resolver`
Produces match candidates/reasons/confidence. Ambiguous destructive merge requires review. Evals: precision/recall, critical false-merge rate, split recovery, multilingual aliases.

### `agent.intel.contact_enrichment`
Finds allowed business contact routes/role candidates; cannot grant outreach eligibility. Evals: correctness/freshness/role hallucination/policy.

### `agent.intel.website`
Proposes digital capability/issue observations from bounded fetch evidence. One failure ≠ broken/no website. Evals: site-state/capability precision and transient robustness.

### `agent.intel.signal`
Detects configured SignalDefinition versions and creates candidates only. Evals per signal precision/recall/F1, explicit-vs-inferred, dedupe, absence-signal false positives.

### `agent.intel.news_event`
Dated entity-grounded events; eval entity/date/freshness/duplicate/source authority.

### `agent.intel.procurement`
RFI/RFP/RFQ/tenders/vendor requests with issuer/deadline/status/actual request evidence. High explicit-demand precision required.

### `agent.intel.workforce`
Hiring/role/team events with employer/location/title/date evidence. Removed posting does not imply hire completed.

### `agent.intel.technology`
Observable tech adoption/removal/change; eval false inference and freshness.

### `agent.intel.cx_reputation`
Review/CX themes only from permitted sources with sample/trend thresholds; eval overgeneralization and multilingual accuracy.

### `agent.control.evidence_verifier`
Independently returns Verified / Insufficient / Contradicted / Stale / PolicyInvalid. Cannot manufacture missing proof. Strict false-verification threshold.

### `agent.commercial.opportunity`
Maps verified inputs to enabled ServiceDefinition ID/version with Why Now + positive/negative evidence and fit/urgency/value/confidence. Unsupported service recommendation fails validation.

### `agent.commercial.lead_qualifier`
Evaluates QualificationFramework; T1. Eval calibration, missing-data and false qualify/disqualify.

### `agent.commercial.lead_scorer`
Assists feature interpretation/explanation; deterministic formula engine remains authoritative where defined. Eval component correctness/ranking/calibration.

### `agent.commercial.buying_committee`
Maps role gaps and evidence-backed people; predicted role without person remains gap. Strict contact hallucination control.

### `agent.commercial.lead_router`
Recommendation only when deterministic routing unresolved. Server atomic routing is authoritative.

### `agent.commercial.next_action`
Proposes research/review/wait/nurture/task/draft actions with evidence/preconditions/benefit/cost/expiry/prohibitions. Server revalidates execution.

### `agent.commercial.outreach_draft`
Human-review draft only at launch. Requires current ContactEligibility, no fabricated personalization and channel-policy disclosure/opt-out requirements.

### `agent.control.compliance`
Explains policy/missing classification; deterministic ConnectorPolicy/Jurisdiction engine remains authority. Unsafe override = zero tolerance.

### `agent.control.security_critic`
Flags prompt injection/tool abuse/exfiltration/malicious memory; deterministic guards enforce. Eval injection catch/false block/secret scenarios.

### `agent.control.cost_optimizer`
Proposes cheaper allowed execution; cannot raise hard budget. Eval quality-adjusted savings/budget compliance.

### `agent.control.memory_curator`
Allowed memory promotion/stale/conflict/dedupe; no global procedural policy mutation. Eval bad promotion/provenance/delete propagation.

### `agent.control.evaluator`
Independent structured accept/reject/review using evidence/policy, not generator hidden reasoning. Monitor false accepts and correlated evaluator failure.

### `agent.research.market_scout`
Daily market research proposals only; no code/merge/activation. Eval novelty/dedup/freshness/relevance/issue spam.

### `agent.control.data_quality`
Finds stale/contradictory/duplicate/missing-provenance anomalies; no silent destructive correction.

## Autonomy
T0 read/explain; T1 propose; T2 approved reversible internal; T3 external reversible only under explicit future policy; T4 high-impact requires human approval.

Launch keeps external send, ambiguous merge, suppression override, policy mutation, destructive deletion, billing/entitlements and global procedural-memory publication outside autonomous model control.

## Evaluation system
Golden sets; regression sets from sanitized incidents/corrections; adversarial prompt/tool/memory/tenant/fan-out cases; shadow/canary model/prompt versions; schema/validator → task metrics → workflow → multi-agent handoff → red-team → production sampled review → outcome/calibration.

Zero-tolerance categories: cross-tenant leakage, unapproved tool/source, suppression/policy/hard-budget bypass, fabricated send success and unsupported canonical mutation.

Precision-critical tasks (entity merge/contact target/explicit demand/evidence verification) have stricter release gates than exploratory recommendations.

## Eval records
`EvalSuite`, `EvalCase`, `EvalRun`, `EvalResult`, `AgentReleaseCandidate`, `AgentReleaseDecision` version dataset/model/prompt/agent, metrics/failures/reviewer/promotion/rollback. Production outcomes become governed eval data, never silent self-modification.

## Fallbacks
Invalid schema: bounded repair then review/fail. Model outage: approved fallback/deterministic/manual. Evaluator rejects: no high-impact mutation. Budget exhausted: partial/BudgetStopped. Policy/tool unavailable: explicit blocked/skipped; never invent substitute source.

## Observability
Per agent/version task success, schema/retry, evidence/evaluator state, human acceptance, task precision/recall/calibration where labeled, policy/security violations, tool mix, latency, token/API/credit/currency cost and fallback.

## Gate
Derive exact JSON schemas/test fixtures, initial numeric thresholds from representative pilot data, approved model/provider ADR and threat-model validation before implementation.