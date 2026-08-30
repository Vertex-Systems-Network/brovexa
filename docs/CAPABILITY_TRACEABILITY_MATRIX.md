# Brovexa — End-to-End Capability Traceability Matrix v1.0

Status: **M00 canonical traceability baseline**
Owner: Linear `ABD-252`

This matrix is the implementation handoff contract. Every material capability is either `BUILD`, `DEFER`, `BLOCKED`, `HUMAN_DECISION` or `REJECT` and has a canonical owner. Provider-specific rows remain gated until their provider/legal prerequisites are satisfied; that does not authorize them through M01.

## Global implementation conventions

### Permission key namespaces
- `workspace.*`
- `member.*`
- `role.*`
- `research.*`
- `source.*`
- `business.*`
- `evidence.*`
- `signal.*`
- `opportunity.*`
- `lead.*`
- `task.*`
- `outreach.*`
- `crm.*`
- `agent.*`
- `memory.*`
- `billing.*`
- `api.*`
- `webhook.*`
- `export.*`
- `admin.*`
- `security.*`

Every server mutation checks a concrete key plus workspace/resource scope; UI hiding alone never authorizes.

### Data classes
- `PUBLIC_SOURCE_TRANSIENT`
- `PUBLIC_SOURCE_STORABLE`
- `BUSINESS_DATA`
- `PERSONAL_BUSINESS_CONTACT`
- `WORKSPACE_CONFIDENTIAL`
- `SECURITY_SENSITIVE`
- `BILLING_FINANCIAL`
- `AUDIT_IMMUTABLE`
- `AI_DERIVED`

Retention/export is additionally constrained by SourcePolicy, jurisdiction, workspace policy and deletion state.

### Test/eval ID families
- `AUTH-*` identity/session/RBAC
- `TENANT-*` workspace isolation
- `DATA-*` canonical schema/migrations/integrity
- `JOB-*` durable work/idempotency/recovery
- `SRC-*` source-policy/connector rules
- `GEO-*` geography/taxonomy
- `EVID-*` evidence/provenance
- `AI-*` agent/tool/memory/model/evals
- `SIG-*` signal detection
- `OPP-*` opportunity/scoring
- `LEAD-*` Lead OS/routing/stage/nurture
- `CRM-*` provider/import/sync
- `OUT-*` suppression/outreach
- `BILL-*` credits/subscription/payment
- `WEB-*` public/app UX/accessibility
- `CLIENT-*` Desktop/extension trust
- `OPS-*` CI/observability/backup/release
- `SEC-*` abuse/threat/security

### Package ownership
Initial monorepo ownership targets:
- `apps/web`
- `apps/api`
- `apps/worker`
- later `apps/desktop`, `apps/extension`
- `packages/contracts`
- `packages/domain`
- `packages/config`
- `packages/security`
- `packages/observability`
- `packages/testing`
- later `packages/ui`, `packages/ai`, `packages/connectors`

## Capability matrix

| Capability | Surface / input | Canonical data/service | Permission | Data / billing | Failure / recovery | Test owner | Package | Decision |
|---|---|---|---|---|---|---|---|---|
| Register | public auth form | User/IdentityChallenge | public + abuse controls | SECURITY_SENSITIVE / none | enumeration-safe error, retry/rate-limit | AUTH-001..004 | api/web | BUILD after identity boundary |
| Login/session | Web/Desktop/browser auth | Session/Device/FederatedIdentity | authenticated | SECURITY_SENSITIVE | revoke/expiry/risk reauth | AUTH-010..019 | api/security | BUILD M01 primitive |
| Forgot/reset | public auth form | RecoveryChallenge/Credential | public + purpose-bound token | SECURITY_SENSITIVE | single-use/expiry/revoke sessions | AUTH-020..026 | api/security | BUILD M01 primitive |
| Workspace create/switch | onboarding/app | Workspace/Membership | workspace.create/view | WORKSPACE_CONFIDENTIAL | atomic owner creation, switch scope revalidated | TENANT-001..008 | api/domain | BUILD M01 primitive |
| Members/invites | settings | Membership/Invite | member.view/invite/manage | WORKSPACE_CONFIDENTIAL | expiry/revoke/last-owner safeguards | AUTH-030..039 | api/domain | BUILD foundation then UI |
| Roles/permissions | settings/admin | Role/PermissionBinding | role.view/manage | SECURITY_SENSITIVE | no privilege self-escalation | AUTH-040..049, TENANT-* | api/security | BUILD M01 primitive |
| Service accounts/API credentials | settings/API | ServiceAccount/ApiCredential | api.manage | SECURITY_SENSITIVE | one-time secret, rotate/revoke/rate-limit | AUTH-050..059, SEC-* | api/security | DEFER UI; contract BUILD-ready |
| Notification Center | app | NotificationEvent/DeliveryAttempt | workspace-scoped read/manage | WORKSPACE_CONFIDENTIAL | delivery adapter failure never loses event | OPS-020..029 | api/worker | BUILD later M08 |
| Webhooks | settings/API | WebhookEndpoint/Delivery | webhook.manage | WORKSPACE_CONFIDENTIAL | signed at-least-once, retry/DLQ/redelivery | OPS-030..039 | api/worker | BUILD later M08 |
| Feature flags/kill switches | admin | FlagDefinition/Assignment | admin.flags | SECURITY_SENSITIVE | server-authoritative fallback/expiry | OPS-040..045 | api/config | BUILD M01 internal primitive |
| World/region/country targeting | Job Builder | GeoArea/HierarchyVersion | research.create | BUSINESS_DATA | ambiguity/preflight block | GEO-001..008 | domain/contracts | BUILD M02A |
| Subdivision/city/locality | Job Builder | GeoArea/Alias | research.create | BUSINESS_DATA | local admin labels/provider mismatch | GEO-010..019 | domain | BUILD M02A |
| Radius/polygon/territory | Job Builder/map | GeoBoundary/Territory | research.create | WORKSPACE_CONFIDENTIAL | invalid geometry/dedupe overlap | GEO-020..029 | domain | BUILD M02A |
| Industry/niche taxonomy | Job Builder | TaxonomyNode/MappingVersion | research.create | BUSINESS_DATA | unknown mapping/custom fallback | GEO-030..039 | domain | BUILD M02A |
| Natural-language Job Builder | app | DraftResearchJob/ResearchJobVersion | research.create | WORKSPACE_CONFIDENTIAL / preflight only | compile visibly; policy/budget cannot be widened | AI-100..109, JOB-001.. | ai/domain | BUILD after Agent runtime |
| Guided Job Builder | app | ResearchJobVersion | research.create | WORKSPACE_CONFIDENTIAL | validation/preflight errors | JOB-010..019 | api/web | BUILD M02A |
| Job preflight | app/API | PreflightEstimate | research.preflight | cost projection only | unknown ranges explicit, no fake precision | JOB-020..029, BILL-001.. | api/worker | BUILD M02A |
| Once/scheduled/continuous job | app/API | Schedule/ResearchRun | research.run/schedule | Research Credits | entitlement/policy/budget recheck each run | JOB-030..049 | worker | BUILD M02A |
| Pause/resume/cancel | job monitor | ResearchRun/WorkUnit state | research.manage | none | cooperative cancellation/checkpoint resume | JOB-050..059 | worker/api | BUILD M02A |
| Source connector selection | planner | SourceCapability/ConnectorPolicy | source.use + research.create | provider cost | unapproved/expired policy = blocked | SRC-001..019 | connectors/worker | BUILD only approved providers |
| Google/local discovery | acquisition | SourceRef/CandidateBusiness | source.use.google_* | policy-dependent | caching/attribution/TTL enforced | SRC-GOOGLE-* | connectors | HUMAN_DECISION provider profile |
| Registries/open data | acquisition | SourceRef/CandidateBusiness | source.use.<id> | license-dependent | dataset version/license handling | SRC-REG-* | connectors | BUILD per approved dataset |
| Company website fetch | acquisition | FetchArtifact/EvidenceCandidate | source.use.web | PUBLIC_SOURCE_* | SSRF/robots/terms/timeout/JS partial | SRC-WEB-*, SEC-SSRF-* | connectors/worker | BUILD M04 |
| Search/news provider | acquisition/scout | transient results/EvidenceCandidate | source.use.search.<id> | provider cost | storage rights separate from access | SRC-SEARCH-* | connectors | HUMAN_DECISION provider profile |
| Jobs/tenders/reviews/social | acquisition | EvidenceCandidate | source.use.<id> | provider cost | unsupported scraping blocked | SRC-* | connectors | BLOCKED until source profile |
| CSV/XLSX import | app | ImportBatch/Staging/Mapping | business.import | WORKSPACE_CONFIDENTIAL | preview/dedupe/explicit commit/row errors | CRM-001..019 | api/worker | BUILD later |
| Browser evidence capture | extension | EvidenceCandidate | evidence.capture | source-policy dependent | user gesture/min permissions/reverify | CLIENT-EXT-* | extension/api | BUILD M08A |
| Entity resolution | worker/review | Business/Location/Domain/IdentityLink | business.merge/review | BUSINESS_DATA | ambiguous merge review, reversible split | DATA-ENTITY-*, AI-ENTITY-* | domain/worker | BUILD M03 |
| Contact enrichment | worker/app | Contact/ContactChannel/Evidence | business.contact.view/enrich | PERSONAL_BUSINESS_CONTACT / cost | provenance + contactability separate | SRC-CONTACT-*, SEC-PII-* | connectors/worker | BLOCKED until providers/legal profiles |
| Website state | worker/Business 360 | WebsiteObservation/Fact | business.view | BUSINESS_DATA | one failure != no/broken website | EVID-WEB-* | worker/domain | BUILD M04 |
| Evidence Inspector | app | Evidence/FactObservation/Inference | evidence.view | mixed by source | stale/retained/redacted states visible | EVID-001..019 | api/web | BUILD M04/M08 |
| Signal detection | worker | SignalDefinition/Observation | signal.view/configure | AI_DERIVED + evidence | contradiction/freshness/decay | SIG-001.. | ai/worker | BUILD M05 |
| Custom signal | app/AI | DraftSignalDefinition | signal.configure | WORKSPACE_CONFIDENTIAL / cost | review source/evidence/eval before activate | SIG-CUSTOM-* | ai/api | BUILD later |
| Opportunity reasoning | worker/app | Opportunity/ServiceDefinition | opportunity.view | AI_DERIVED | insufficient evidence = no promotion | OPP-001..019 | ai/worker | BUILD M06 |
| Lead scoring | worker/app | ScoreVersion/Components | lead.view | AI_DERIVED | history/calibration/reason codes preserved | OPP-SCORE-*, LEAD-SCORE-* | domain/ai | BUILD M06 |
| Lead promotion | app/worker | Lead/LeadCandidate | lead.create | WORKSPACE_CONFIDENTIAL | pursuit dedupe/compliance check | LEAD-001..009 | api/domain | BUILD M06A |
| Qualification | app/AI | QualificationAssessment | lead.qualify | WORKSPACE_CONFIDENTIAL | missing data creates research gap | LEAD-010..019, AI-LEAD-* | ai/api | BUILD M06A |
| Stage transitions | app/API/CRM | LeadTransition history | lead.transition | AUDIT_IMMUTABLE | transition guards/concurrency conflict | LEAD-020..029 | api/domain | BUILD M06A |
| Routing/assignment | app/worker | AssignmentHistory | lead.assign | WORKSPACE_CONFIDENTIAL | atomic deterministic rules first | LEAD-030..039 | api/worker | BUILD M06A |
| Buying committee | app/AI | ContactRole/RoleGap | lead.view/research | PERSONAL_BUSINESS_CONTACT | predicted role without person stays gap | LEAD-040..049, AI-CONTACT-* | ai/domain | BUILD M06A |
| Next-best action | app/AI | ProposedAction | lead.view/research | AI_DERIVED / estimated cost | execution revalidates preconditions | LEAD-050..059 | ai/api | BUILD M06A |
| Tasks/SLA | app | Task/Activity | task.view/manage | WORKSPACE_CONFIDENTIAL | task result cannot fabricate outreach state | LEAD-060..069 | api | BUILD M06A |
| Nurture/reactivation | worker/app | NurtureCondition/Candidate | lead.manage | WORKSPACE_CONFIDENTIAL / optional research cost | no silent stage jump; bounded rerearch | LEAD-070..079 | worker/ai | BUILD M06A |
| CRM sync | integration | ProviderMapping/SyncState/Conflict | crm.manage/sync | WORKSPACE_CONFIDENTIAL | field authority/loop prevention/reconcile | CRM-020..049 | connectors/worker | DEFER provider adapter until selected |
| Agent orchestration | worker | AgentDefinition/AgentRun/Plan/Handoff | agent.run | WORKSPACE_CONFIDENTIAL / model cost | bounded DAG/checkpoint/fallback | AI-001..019, JOB-* | ai/worker | BUILD M01A after M01 core |
| Context Builder | worker | ContextReceipt | agent.run | mixed/minimum necessary | cross-tenant/freshness/conflict fail closed | AI-020..029, TENANT-* | ai | BUILD M01A |
| Durable memory | worker/app inspector | MemoryRecord/IndexRef | memory.view/propose/manage | AI_DERIVED + source refs | stale/conflict/supersede/delete propagation | AI-MEM-* | ai/domain | BUILD M01A |
| Evidence verifier | worker | EvaluationResult | internal | AI_DERIVED | verified/insufficient/contradicted/stale/policy invalid | AI-EVID-* | ai | BUILD M01A/M05 |
| Independent evaluator | worker | EvalResult/ReleaseDecision | internal | AI_DERIVED / model cost | disagreement escalates; no forced accept | AI-EVAL-* | ai/testing | BUILD M01A |
| Compliance decision | app/backend | ContactEligibility/PolicyDecision | compliance.view | SECURITY_SENSITIVE | suppression wins; unknown fails closed | OUT-COMP-*, SEC-* | security/domain | BUILD M07 |
| Outreach draft | app/AI | OutreachDraft | outreach.draft | PERSONAL_BUSINESS_CONTACT / model cost | no fabricated personalization; review required | OUT-DRAFT-* | ai/api | BUILD M07 |
| Human approval | app | ApprovalRecord | outreach.approve | AUDIT_IMMUTABLE | execution-time policy recheck | OUT-APPROVE-* | api/security | BUILD M07 |
| External send | provider | OutreachRecord | outreach.send | contact/provider cost | idempotency/suppression/frequency/provider failure | OUT-SEND-* | connectors/worker | DEFER controlled; no autonomous launch default |
| Suppression/opt-out | all outbound | SuppressionRecord | compliance.manage | PERSONAL_BUSINESS_CONTACT | execution-time race check/global precedence | OUT-SUP-* | domain/security | BUILD before any send |
| Web operator console | Web | canonical API | permissions by resource | WORKSPACE_CONFIDENTIAL | loading/empty/partial/error/accessibility | WEB-APP-* | web | BUILD M08; shell starts M01 |
| Desktop | Tauri | canonical API/local bounded cache | same server RBAC | source-policy-aware local data | secure storage/deep links/offline/version mismatch | CLIENT-DESK-* | desktop | BUILD M08A |
| Chrome extension | WXT MV3 | canonical API/EvidenceCandidate | same server RBAC | page data transient by default | activeTab/optional hosts/no reusable content token | CLIENT-CHR-* | extension | BUILD M08A |
| Firefox extension | WXT adapter | canonical API | same server RBAC | same | runtime capability degradation explicit | CLIENT-FF-* | extension | BUILD M08A |
| Mobile companion | future | canonical API | same | same | n/a | CLIENT-MOB-* | future | DEFER extension point |
| Landing/product website | public Web | CMS/static product content | public/admin publish | PUBLIC | claims tied to shipped/synthetic fixture truth | WEB-PUBLIC-* | web | BUILD M08B, shell may start M01 |
| Signup onboarding | Web | Workspace preferences/config | workspace.create/manage | WORKSPACE_CONFIDENTIAL | resumable/skippable optional steps | AUTH-ONB-* | web/api | BUILD after auth |
| Plan/entitlement | billing | PlanVersion/Entitlement | billing.view/admin internal | BILLING_FINANCIAL | server authoritative/grandfathering | BILL-ENT-* | api/domain | BUILD later M08B |
| Research Credits | jobs/billing | CreditLedger/RateTable | billing.view/internal debit | BILLING_FINANCIAL | reserve/settle/release/idempotent no double charge | BILL-CREDIT-* | api/worker | BUILD before paid research |
| Checkout/payment | public/settings | Subscription/ProviderMapping | billing.manage | BILLING_FINANCIAL | webhook/reconciliation authority, redirect not authority | BILL-PAY-* | api/web | HUMAN_DECISION provider/entity |
| Upgrade/downgrade/cancel | billing portal | Subscription/Entitlement | billing.manage | BILLING_FINANCIAL | preview/proration/over-limit/read-only; no data delete | BILL-LIFE-* | api/web | BUILD after provider ADR |
| Tax/invoices/refund/dunning | billing | BillingEvent/InvoiceRef/Refund/Dispute | billing.view/support | BILLING_FINANCIAL | reconciliation/out-of-order/provider outage | BILL-FIN-* | api/worker | HUMAN_DECISION MoR/direct responsibilities |
| Daily Market Scout | GitHub/worker | ScoutRun/Finding/Proposal | safe-output service account | PUBLIC_SOURCE_* / bounded cost | dedupe/meaningful delta/no auto-code | AI-SCOUT-*, SRC-* | future worker/workflow | DEFER until explicit activation |
| Saved views/audiences | app | SavedView/Audience | resource view/share | WORKSPACE_CONFIDENTIAL | sharing never grants underlying access | WEB-VIEW-* | api/web | BUILD M08 |
| Exports | app/API | ExportJob | export.create/download | source/privacy constrained | async/expiry/audit/policy recheck | OPS-EXP-* | worker/api | BUILD M08 |
| Audit/support | admin | AuditEvent/SupportAccess | admin.support/security.audit | AUDIT_IMMUTABLE | no silent impersonation | SEC-AUDIT-* | api/security | BUILD foundation primitives |
| Canonical DB | backend | PostgreSQL schemas | internal | all classes | transaction/constraint/PITR/migration safety | DATA-* | api/domain | BUILD M01 |
| Queue/workers | backend | ResearchJob/WorkUnit checkpoints + BullMQ | internal | cost-bearing | Postgres recovery/idempotency/noeviction | JOB-* | worker | BUILD M01 |
| Semantic index | backend | pgvector derived index | same resource read | derived | permission before retrieval/rebuildable | AI-MEM-INDEX-* | domain/ai | BUILD when needed |
| Evidence object store | backend | ObjectRef | same evidence permission | source-policy constrained | encryption/lifecycle/deletion propagation | EVID-OBJ-* | api/worker | BUILD M01 abstraction, provider later |
| CI quality baseline | GitHub Actions | workflow evidence | repo permissions | none | fail closed; baseline failures explicit | OPS-CI-* | repo | BUILD first M01 slice |
| Observability | all server apps | logs/metrics/traces | admin/ops | redacted | correlation across request/job; provider outage safe | OPS-OBS-* | observability | BUILD M01 |
| Backup/restore | DB/object store | backup metadata/runbook | privileged ops | all classes | measured restore/RPO/RTO before prod | OPS-DR-* | infra | BUILD staging/prod readiness |
| Production deployment | release | Release/Deployment evidence | privileged release | all | rollback class + postdeploy verify | OPS-REL-* | infra | BLOCKED until hosting/IaC/release gate |

## Explicit Human Decisions / later blockers

The matrix is complete as a planning/traceability artifact even where a later decision is intentionally unresolved. The unresolved item is not interpreted as implemented or approved:

1. exact launch identity provider — canonical identity boundary is provider-neutral; decision required before provider integration
2. exact production hosting/cloud/region/HA/IaC — not required for local/M01 repository foundation; required before staging/production deployment
3. exact launch source connector inventory and field/TTL/export rights — required before each connector is enabled
4. exact production jurisdiction/channel legal profiles — required before contact/outreach enablement in that profile
5. exact model/provider allowlist and numeric AI release thresholds — required before production AI Agent release
6. actual Brovexa legal operating entity and payment provider onboarding — required before checkout activation
7. exact Research Credit allowances/prices/concurrency/max-job limits — required before paid plans are published/activated
8. exact launch UI languages — localization architecture is required now; final enabled locale set is a product launch decision
9. outbound send providers/channels — deliberately deferred and human-controlled

## Negative requirements carried into implementation

- no cross-workspace resource access even with guessed IDs
- no UI-only authorization
- no source-policy bypass through AI/custom `internet` requests
- no unsupported evidence promoted to Fact/Signal/Opportunity/Lead
- no LLM context as canonical workflow state
- no queue/Redis as canonical ResearchJob truth
- no double charge on retries/replay
- no silent destructive downgrade/payment failure behavior
- no autonomous suppression override or bulk outreach at launch
- no browser content-script reusable credentials
- no deep-link authorization
- no provider redirect used as payment authority
- no support impersonation without privileged audited workflow
- no stale/deleted memory retained in derived indexes without invalidation
- no production-ready/test-green claim without executed evidence

## M01 entry/exit traceability

M01 may begin after owner approval because its unresolved later-vendor/legal decisions are explicitly isolated. M01 must establish:

- monorepo/repository structure
- pinned runtime/package-manager policy
- typed shared contracts/config
- API and Web foundation shells
- canonical environment validation
- PostgreSQL migration/data-layer harness
- queue/worker durable-state harness
- auth/RBAC/tenant primitives without prematurely choosing a hosted identity vendor
- testing harness + FAST/FULL gates
- executable GitHub CI quality/security baseline
- observability/correlation/health primitives
- secure local/dev/test configuration and documented commands

M01 is not complete until its own executed tests/CI evidence satisfy `ABD-216` acceptance criteria.

## ABD-252 exit verdict

All material currently planned Brovexa capabilities are now assigned a user/surface, canonical engine/data concept, permission namespace, data/billing class, failure/recovery expectation, test/eval family, package owner and Build/Defer/Blocked/Human-Decision state.

Future provider-specific details are represented as explicit gated child contracts rather than unknown hidden scope. New capabilities must be added here or to a versioned successor before implementation.