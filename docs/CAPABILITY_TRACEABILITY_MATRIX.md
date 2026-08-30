# Brovexa — End-to-End Capability Traceability Matrix v0.2

Status: **Living M00 / ABD-252 artifact — first substantive pass, not final completeness approval**

Every material capability must trace:

`User/Surface → Input → Preconditions → Source/Agent/Service → Canonical Data → State → Permission → Cost/Budget → Compliance → Failure/Recovery → Test/Eval → Owner → Build/Defer/Reject`.

Decision states: LOCKED, PROVISIONAL, HUMAN_DECISION, DEFERRED, REJECTED, BLOCKED.

## Coverage map

### Identity / workspace / platform
- Register → Identity/User/Credential → enumeration/rate/policy controls → ABD-235 — LOCKED contract
- Login/session → Session/Device/FederatedIdentity → PKCE/revoke/tenant revalidation → ABD-235/226 — LOCKED
- Forgot/reset → purpose-bound challenge → single-use/expiry/MFA preservation → ABD-235 — LOCKED
- Workspace lifecycle → Workspace/Membership/DeletionPlan → last-owner/retention/billing/audit → ABD-256 — LOCKED contract
- Members/roles/teams → Membership/Role/Permission → capability-based authorization/session revalidation → ABD-256/216 — LOCKED
- Notification Center → NotificationEvent/DeliveryAttempt → redaction/dedupe/preferences → ABD-256 — LOCKED
- API credentials → ServiceAccount/ApiCredential → scope/rotate/revoke/rate/audit → ABD-256 — LOCKED
- Webhooks → Endpoint/Event/Delivery → signing/at-least-once/retry/dedupe → ABD-256 — LOCKED
- Feature flags/kill switches → server-authoritative FlagDefinition → audit/expiry/no sensitive targeting → ABD-256 — LOCKED

### Global targeting / ResearchJob
- World/region/country → GeoArea/Hierarchy/Version → versioned provider-independent IDs → ABD-242 — LOCKED architecture
- State/province/city → GeoAlias/Hierarchy → no universal State assumption/disambiguation → ABD-242 — LOCKED
- Radius/polygon/territory → GeoBoundary/Territory → bounds/validation/dedupe → ABD-242 — LOCKED
- Industry/niche → TaxonomyNode/Mapping → versioned ISIC/NAICS/NACE/provider/custom crosswalks → ABD-242 — LOCKED
- AI Job Builder → free text → Draft/compiled ResearchJobVersion → visible structured plan; cannot override policy/budget → ABD-242/212 — LOCKED
- Guided Job Builder → typed objective/geo/niche/filters/signals/sources/depth/output/schedule/budget → ABD-242 — LOCKED
- Preflight → coverage/cost/policy artifact → ranges/unknowns instead of fake precision → ABD-242/214/236 — LOCKED
- Saved templates → reusable Job config → mandatory re-preflight when policy/source changes → ABD-242/256 — LOCKED
- Once/scheduled/continuous → Schedule/Run → every run revalidates entitlement/policy/budget → ABD-247/214 — LOCKED architecture

### Sources / acquisition / entities
- Google/local discovery → connector candidate data → policy/cache/attribution restrictions → ABD-210/217/246 — PROVISIONAL provider
- Registries/open data → source adapters → per-dataset license/retention → ABD-210/246 — PROVISIONAL
- Company websites → SSRF-safe fetch → robots/terms/purpose/no bypass → ABD-210/219 — LOCKED contract
- Search/news → transient SearchProvider results → storage rights separate from search access → ABD-210/246/231 — PROVISIONAL
- jobs/tenders/reviews/social → source-specific adapters → generic unauthorized scraping blocked → ABD-210/246 — PROVISIONAL/BLOCKED by source
- CSV/XLSX → isolated staging/preview/dedupe/explicit commit → ABD-251 — LOCKED
- browser capture → EvidenceCandidate only → user gesture/minimum permissions/verification → ABD-228/226 — LOCKED
- entity resolution → canonical Business/Location/Domain mappings → reversible merge/split/conflict review → ABD-218/211/212 — LOCKED
- contact enrichment → Contact/Channel/Evidence → provenance + personal/business classification + contactability separate → ABD-218/210 — PROVISIONAL provider

### Evidence / website / signals / opportunity
- Website state → WebsiteObservation/Fact → `no website` requires positive verification → ABD-219 — LOCKED
- Digital features → Fact/Inference → blocked/JS-heavy = unknown/partial, not fabricated → ABD-219/212 — LOCKED
- Evidence Inspector → Evidence/Fact lineage → SourcePolicy display/retention → ABD-223/211 — LOCKED
- Signal detection → SignalDefinition/Observation → explicit/inferred, freshness/contradictions → ABD-248/220/212 — LOCKED ontology
- Custom signal → Draft SignalDefinition → source/evidence/cost/policy review → ABD-248/212 — LOCKED
- Opportunity mapping → Service ID + evidence/negative evidence → no promotion when insufficient → ABD-221/248 — LOCKED
- Scoring → versioned component Score → historical scores preserved/explainable → ABD-221/212 — LOCKED

### Lead OS
- Lead promotion → Lead/LeadCandidate → pursuit dedupe/compliance decision → ABD-243/249 — LOCKED
- Qualification → versioned framework/evidence/reason codes → missing information becomes research gap → ABD-243/250 — LOCKED
- Stage transitions → immutable transition history + guards → concurrency conflict handling → ABD-243/249 — LOCKED
- Routing → assignment history → deterministic rule first/atomic assignment → ABD-243/249 — LOCKED
- Buying committee → ContactRole/RoleGap → never hallucinate a person → ABD-250/212 — LOCKED
- Next-best action → ProposedAction + preconditions/cost/expiry → revalidate at execution → ABD-250 — LOCKED
- Tasks/SLA → Task/Activity → task completion cannot fabricate outreach state → ABD-249/256 — LOCKED
- Nurture/reactivation → NurtureCondition/ReactivationCandidate → no silent stage jump → ABD-249/250 — LOCKED
- CRM sync → ProviderMapping/SyncConflict → field authority/loop prevention/reconciliation → ABD-251 — LOCKED contract

### AI Agent OS / memory
- Orchestration → AgentRun/Plan/Handoff → bounded tool/memory/budget → checkpoint resume → ABD-241/244 — LOCKED architecture
- Context Builder → ContextReceipt → tenant/authority/freshness/minimum necessary → ABD-241/212 — LOCKED
- Durable memory → MemoryRecord/history → canonical facts stay domain-owned; promotion/supersession/delete/quarantine → ABD-241 — LOCKED
- Evidence verifier → EvaluationResult → grounding/contradiction → ABD-212 — LOCKED
- Independent evaluator → high-impact output evaluation → disagreement escalates → ABD-212 — LOCKED
- Autonomy → AgentDefinition tiers/tool scopes → external/high-impact human/policy gates → ABD-241/213 — LOCKED

### Outreach / compliance
- Contactability → jurisdiction+recipient+channel+purpose+consent/DNC+provenance → suppression wins, unknown fails closed → ABD-210/222 — PROVISIONAL legal profiles
- Outreach draft → evidence-grounded draft → false/unsupported claims blocked → ABD-222/250 — LOCKED contract
- Human approval → ApprovalRecord + latest policy recheck → policy change invalidates approval → ABD-222 — LOCKED
- External send → provider adapter → not autonomous launch default → ABD-222 — DEFERRED/controlled
- Suppression/opt-out → SuppressionRecord → execution-time race check → ABD-210/222 — LOCKED

### Web / Desktop / extensions
- Web console → canonical API → role-aware/a11y/loading/partial/error states → ABD-223/233 — LOCKED IA
- Desktop → Tauri client → secure storage/capabilities/deep-link validation/offline bounded cache → ABD-227/226 — LOCKED contract
- Chrome → WXT MV3 → activeTab/optional hosts/untrusted page/no reusable content-script token → ABD-228/226 — LOCKED
- Firefox → shared WXT + browser adapter → explicit API/runtime degradation → ABD-229/226 — LOCKED
- Mobile companion → future canonical API client for review/notifications/Lead summaries → DEFERRED extension point, not launch dependency

### Public website / activation / monetization
- Landing/product site → shipped/evidence-based claims + synthetic demo data → ABD-234/240 — LOCKED IA
- Signup onboarding → resumable workspace/use-case/geography/services configuration → ABD-235 — LOCKED
- Plan entitlement → PlanVersion/Entitlement → server authoritative/provider-neutral → ABD-236 — LOCKED model
- Research Credits → immutable ledger/rate table → no double charge/internal retry charging → ABD-236 — LOCKED
- Checkout/payment → Subscription/ProviderMapping → signed webhook/reconciliation; redirect not authority → ABD-237/238/239 — PROVISIONAL provider
- Upgrade/downgrade/cancel → entitlement lifecycle → no silent data deletion → ABD-238/236 — LOCKED behavior

### Market / reports / operations
- Daily Market Scout → ScoutRun/Finding/Proposal → approved sources/hard budgets/no auto-code → ABD-231/232 — LOCKED contract, implementation blocked
- Saved views/audiences → structured SavedView/Audience → permission/policy-aware → ABD-256/223 — LOCKED
- Export → ExportJob → field/source/privacy restrictions, protected temporary download → ABD-256/223 — LOCKED
- Usage/cost → projections from Usage/Cost ledgers → no hidden variable cost → ABD-233/236/214 — LOCKED IA
- Audit/support → AuditEvent/SupportAccess → no silent impersonation → ABD-256/213/224 — LOCKED

### Infrastructure / recovery
- Canonical DB → PostgreSQL 18.x → reviewed migrations/constraints/tenant scope/PITR → ABD-214/211 — LOCKED architecture
- Queue/workers → BullMQ + Valkey/Redis → PostgreSQL checkpoints + noeviction + idempotency → ABD-214/247 — LOCKED architecture
- Semantic index → pgvector derived → permission before retrieval/rebuildable → ABD-214/241 — optional LOCKED pattern
- Evidence objects → R2/S3 abstraction → SourcePolicy/lifecycle/encryption → ABD-214/210 — PROVISIONAL provider
- Launch hosting → Render candidate → environment separation/PITR/private network → ABD-214 — PROVISIONAL provider
- Scale hosting → AWS managed stack → explicit migration trigger → ABD-214 — DEFERRED trigger
- Temporal/OpenSearch/Kubernetes → explicit reevaluation triggers → ABD-214 — DEFERRED

## Gap found and closed in v0.2

Workspace administration, Notifications, Developer API/Webhooks, Saved Views/Exports, privileged Support/Admin, localization and Feature Flags were previously scattered. They now have a canonical owner: **ABD-256** + `docs/PLATFORM_OPERATIONS.md`.

## Still unresolved before final ABD-252

- exact launch source connector inventory + field storage/export/TTL
- exact active SignalDefinition catalog + evidence/eval thresholds
- exact AI model/provider allowlist + residency/quality/cost pilot results
- identity provider final ADR
- payment provider + actual operating-entity eligibility
- launch hosting region + PostgreSQL HA + measured restore RPO/RTO
- exact included Research Credits/concurrency/max job sizes from pilot COGS
- exact launch UI languages
- outbound send providers/channels deliberately deferred
- production legal/compliance review for enabled jurisdictions

## Explicit future extension points

- mobile companion
- Slack/Teams notification/action adapters
- Gmail/Outlook/Calendar context where user-authorized and policy-safe
- additional CRM/ERP/helpdesk/marketing automation adapters
- private enterprise connectors/MCP adapters
- additional geographies/taxonomies/source datasets
- Temporal/OpenSearch/Kubernetes only after documented triggers

## Final matrix completion

Before ABD-252 can complete, each capability gains exact permission keys, schema/API version, billing effect, data classification/retention/export class, observability/SLO where material, happy-path acceptance, failure/abuse case, test/eval ID, implementation package and Build/Defer/Reject rationale.