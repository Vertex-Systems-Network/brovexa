# Brovexa — Canonical Data, Evidence & Provenance Model

Status: **Planning Only — logical schema, not migrations or development authorization**

## Core rule
Provider responses, LLM outputs, queue payloads, browser state and vector indexes are not canonical truth. Every material value must retain entity, provenance, time, policy, verification, version and correction history.

## Identity/versioning
- Canonical IDs are opaque Brovexa IDs; provider/CRM/ISO/domain/email/model IDs are mappings.
- Observational records carry observed/fetched/verified/validity times.
- Definitions that affect interpretation are versioned: policies, taxonomies, services, signals, scores, agents/prompts, ResearchJobs, plans/entitlements and APIs.

## Tenant/auth domain
`User`, `Workspace`, `WorkspaceMember`, `Role`, `Permission`, `RolePermission`, `ServiceAccount`, scoped API credentials and typed workspace configuration.

Tenant authorization is server-side. Client-supplied workspace IDs never grant access.

## Geography/classification
`GeoDatasetVersion`, `GeoArea`, `GeoAlias`, `GeoHierarchyEdge`, `GeoCodeMapping`, `GeoBoundaryRef`, `GeoChangeEvent`, `TaxonomyDatasetVersion`, `TaxonomyNode`, `TaxonomyAlias`, `TaxonomyMapping`, `WorkspaceTaxonomyNode`.

## Source/policy
`Connector`, `ConnectorInstance`, `SourceCapability`, `ConnectorPolicy`, `JurisdictionProfile`, `SourceReference`, optional policy-permitted `SourcePayloadRef`.

Raw/provider content is stored only where rights permit; SourceReference/evidence may survive under narrower policy states where allowed.

## Business entity graph
- `Business` canonical organization/account
- `BusinessName` official/trading/former/aliases with provenance/validity
- `BusinessLocation` branch/site/facility with independent status/contacts/geography
- `PostalAddress` structured address object
- `Domain` normalized domain identity
- `Website` Business/Location↔Domain/URL relationship and role/state
- `ContactChannel` email/phone/form/chat/social/etc., owner type, generic/personal class, provenance, verification/freshness/policy
- `Person` minimal business professional/contact entity only where allowed
- `EmploymentAffiliation` Person↔Business/Location with title/role/department/seniority/dates/evidence
- `BusinessRelationship` parent/subsidiary/franchise/brand/operator/partner graph

## Entity resolution
`EntityExternalMapping`, `EntityMatchCandidate`, `EntityMergeEvent`, `EntitySplitEvent`.

Names/addresses/emails are not canonical identity. Merge/split is audited and reversible; provider records are not overwritten to manufacture canonical matches.

## Evidence/facts/inference

### `Evidence`
Policy-permitted evidentiary unit tied to SourceReference(s), subject, dates/hash, authority, verification and producing user/rule/agent/run.

### `FactDefinition` + `FactObservation`
History/provenance-aware factual attributes. Observation lifecycle: Candidate / Verified / Contradicted / Superseded / Expired / Rejected.

### `FactCurrentProjection`
Rebuildable current best view for fast querying/UI; not source history.

### `Inference`
AI/rule interpretation with exact input fact/evidence IDs, output schema, model/rule/prompt/tool versions, confidence and evaluator result. Inference cannot silently replace a verified FactObservation.

## Website/digital intelligence
`WebsiteSnapshot`, `DigitalCapabilityObservation`, `DigitalIssueObservation`; transient fetch failure is not automatically a durable broken-site fact.

## Signals/opportunities/scoring
`SignalDefinition`, `SignalObservation`, optional corroborating `SignalCluster`, `ServiceDefinition`, `Opportunity`, exact Evidence/Signal link tables, `ScoreModel`, immutable `ScoreSnapshot`.

Opportunity/Lead current scores are projections over immutable score history.

## Research execution
`ResearchJob`, immutable `ResearchJobVersion`, `PreflightResult`, `ResearchRun`, `WorkUnit`, `SourceTask`, `RunCheckpoint`, `RunBudgetLedger`, `CoverageMetric`.

Progress is derived from real bounded units/coverage; long-running state survives workers/models/queues.

## Agent/memory domain
`AgentDefinition`, `AgentRun`, `AgentStep`, `ToolCall`, `AgentHandoff`, `HumanReviewRequest`, `EvaluationResult`, `MemoryRecord`, `MemoryEdge`, `MemoryIndexRef`.

Tool audit payloads are redacted/minimum necessary. Embedding/vector pointers are rebuildable derivatives.

## Lead/deal domain
`Lead`, workspace `LeadStageDefinition`, immutable `LeadStageTransition`, `LeadQualification`, score snapshots, `LeadAssignment`, smart/static lead lists, `BuyingRoleDefinition`, `LeadBuyingRoleCandidate`, `Task`, immutable `Activity`, `NurtureRule`, `NurtureSubscription`, `Deal`, `DealStageTransition`, `DealOutcome`.

Lead references canonical Business/Opportunity/Contact context; it is not a duplicated company row.

## Outreach/compliance
`ContactEligibility`, `ConsentRecord`, `SuppressionRecord`, `DncCheckResult`, `OutreachDraft`, `OutreachApproval`, `OutreachRecord`.

Later suppression/policy change invalidates pending eligibility/approval as appropriate. AI/API/bulk actions cannot bypass this server-side gate.

## CRM/import/integrations
`IntegrationMapping`, `FieldAuthorityRule`, `SyncCursor`, `SyncEvent`, `SyncConflict`, `ImportJob`, `ImportRowResult`.

Provider IDs stay mappings; import preview/dedupe/validation prevents partial silent corruption.

## Billing/usage
`Plan`, `PlanVersion`, `EntitlementDefinition`, `PlanEntitlement`, canonical `Subscription`, `BillingProviderMapping`, verified/idempotent `BillingEvent`, append-only `CreditLedgerEntry`, `UsageEvent`, safe invoice/refund/dispute references.

Payment/card secrets are not normal domain data.

## Audit/events
`AuditEvent`, `DomainChangeEvent`, user `Notification`. Logs/traces/metrics do not replace audit or domain history.

Use an outbox/event pattern so external queues are not canonical state.

## Data classification
At minimum: PUBLIC_BUSINESS, INTERNAL_WORKSPACE, PERSONAL_BUSINESS_CONTACT, CUSTOMER_FIRST_PARTY, COMMERCIAL_CONFIDENTIAL, SECURITY_SENSITIVE, AUTH_SECRET. Prompt/log/export/retention policies follow classification.

## Deletion/correction
- Workspace/user deletion is checkpointed and evaluates billing, retention/legal hold, source obligations, PII anonymization/deletion, audit retention and indexes/object storage.
- Source policy changes may remove raw content and re-evaluate derived facts/inferences.
- Contact/entity corrections supersede and propagate to current projections/eligibility/memory/indexes/CRM where allowed.
- Merge/split preserves Lead/Opportunity/Evidence lineage.

## Logical uniqueness/index invariants
- provider mapping unique within connector/namespace/entity type
- idempotency key unique in operation scope
- one active workspace membership per user/workspace
- append-only ledgers have unique event/reference keys
- domain normalization has explicit scoped uniqueness rules
- business names/addresses/emails are never universal unique identity
- current projections/indexes may optimize reads while history remains canonical

Exact physical indexes/partitioning are ADR work.

## Transaction boundaries
Atomic DB transitions for Lead/Deal stages + audit/outbox, entity merge/split mappings, credits reserve/consume/refund, subscription entitlements, suppression/pending-action blocking, and routing claims. External APIs use idempotent commands/outbox/reconciliation, not long DB transactions.

## Derived indexes/projections
Business 360 current view, current facts/scores, smart-list membership, search/geospatial/vector indexes are rebuildable derivatives carrying version/freshness. Vector similarity never defines identity, fact authority or permission.

## Lineage
`Connector/SourceReference → Evidence/FactObservation → SignalObservation → Opportunity → Lead → Activity/Outreach → Deal/Outcome`

`ResearchJobVersion → Preflight → ResearchRun → WorkUnit/SourceTask/AgentRun → produced Evidence/Fact/Signal`

`Evidence/Fact/Outcome/UserCorrection → MemoryRecord` with provenance back to canonical objects.

The platform must reproduce: Why this business? Why this fact/signal? Why this opportunity/lead/score? Why was this contacted?

## Migration contract
Forward-safe migrations; expand/migrate/contract for breaking changes; resumable/idempotent backfills; deploy compatibility checks; tested backup/restore; destructive changes require review/recovery plan.

## Gate
Convert this logical model into ER/table/index/storage decisions in ABD-214; map all AI outputs through ABD-212; threat-model tenancy/data in ABD-213; validate every UI/job/agent option through ABD-252.