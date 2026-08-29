# Brovexa — M00 Completeness & Decision Control Matrix

Status: **Living M00 control document — final completion owned by ABD-252**

Decision states: `LOCKED`, `PROVISIONAL`, `RESEARCH`, `HUMAN_DECISION`, `DEFERRED`, `BLOCKED`.

## Coverage domains
Each domain must map to canonical issue/document, current decision state and the evidence required before ABD-215.

- Product mission/personas/JTBD/non-goals — ABD-209
- Default service catalog + custom services — ABD-209
- Universal signal/event ontology — ABD-248
- Source policy registry — ABD-210
- Global jurisdiction/privacy/outreach — ABD-210
- Geography registry — ABD-242
- Industry/niche taxonomy — ABD-242
- Research Job Builder + preflight — ABD-242
- Source router/acquisition modes — ABD-246
- Background acquisition/orchestration — ABD-247/214
- Business/entity/location/domain/contact — ABD-211
- Evidence/provenance/facts/inference — ABD-211
- Agent Registry/orchestration — ABD-241
- Durable memory/context — ABD-241
- Model/provider routing — ABD-212/214
- AI evals/release thresholds — ABD-212
- Threat model — ABD-213
- Web operator UI/IA — ABD-223/233
- Desktop client — ABD-226/227
- Chrome/Firefox extension — ABD-226/228/229
- Auth/register/forgot/onboarding — ABD-235
- RBAC/service accounts/audit — ABD-209/213/216
- Website/landing/product visuals — ABD-234
- Pricing/packages/entitlements — ABD-236
- Research Credits/cost ledger — ABD-236/214
- Payment provider/checkout — ABD-237
- Subscription/billing/tax/refund/dunning — ABD-238/239
- SEO/analytics/attribution/privacy — ABD-240
- Lead model/lifecycle — ABD-243
- Lead scoring — ABD-221/243
- Routing/territory/ownership — ABD-243/249
- Buying committee/decision makers — ABD-243/250
- Tasks/SLA/nurture/re-research — ABD-249/250
- Outreach drafting/approval — ABD-222
- Suppression/opt-out — ABD-210/222
- CRM/import/bidirectional sync — ABD-251
- API/webhooks — ABD-223/251
- 24-hour Market Intelligence scout — ABD-231
- Observability/SLOs — ABD-214/224
- Backup/DR/rollback — ABD-214/224
- Security/supply chain — ABD-213/224
- Accessibility/responsive/localization — ABD-223/233
- Multi-language/timezone/currency — ABD-209/223/236
- Admin/support/audit tooling — ABD-213/223/224
- Data export/delete/correction — ABD-210/211/223
- Documentation/runbooks/checkpoints — Engineering Constitution / ABD-216/224
- End-to-end completeness traceability — ABD-252
- Final adversarial readiness audit — ABD-253
- Development authorization — ABD-215

## Day-1 decision snapshot — 2026-08-30

| Domain | State | Durable artifact | Remaining before gate |
|---|---|---|---|
| Product mission/personas/core JTBD/non-goals | `LOCKED` | `PRODUCT_SCOPE_SERVICE_TAXONOMY.md` | final cross-domain contradiction pass |
| Implementation sequencing / usable release definition | `LOCKED` | `LAUNCH_SCOPE_WAVES.md` | later milestone decomposition after M00 |
| Canonical service IDs/versioning/custom-service model | `LOCKED` | `SERVICE_TAXONOMY_REGISTRY.md` | individual signal/evidence weights/evals mature with ABD-212/221 |
| Source policy contract/storage classes | `PROVISIONAL` | `SOURCE_POLICY_MATRIX.md` | connector-by-connector license/field/retention matrix as providers are selected |
| Jurisdiction/channel outreach decision engine | `PROVISIONAL` | `JURISDICTION_OUTREACH_POLICY.md` | production legal review; national EU/ePrivacy profiles; more countries/channels |
| Global geography hierarchy contract | `PROVISIONAL` | `GLOBAL_ACQUISITION_STUDIO.md` | dataset/licensing/import/update ADR and canonical schema ABD-211/214 |
| Industry/niche taxonomy mapping architecture | `PROVISIONAL` | `GLOBAL_ACQUISITION_STUDIO.md` | exact registry/version import/mapping decisions |
| ResearchJob field/version/preflight contract | `LOCKED` | `GLOBAL_ACQUISITION_STUDIO.md` | SourceCapability mappings + DB/API schema implementation design |
| Universal SignalDefinition/Observation contract | `LOCKED` | `UNIVERSAL_SIGNAL_ONTOLOGY.md` | initial active definition catalog/evals/detectors mature in ABD-212/220 |
| All theoretical source/detector implementations | `DEFERRED` | ontology/source extension points | added by adapter/definition without schema rewrite |
| Unmapped-jurisdiction automated outreach | `BLOCKED` | `JURISDICTION_OUTREACH_POLICY.md` | versioned approved jurisdiction/channel profile required |

`LOCKED` above means product/domain contract is stable enough for downstream M00 work; it does **not** mean feature implementation or legal production approval.

## Mandatory traceability columns for final matrix
`Capability / Option / User / Surface / Input / Preconditions / Source-or-Agent / Canonical Data / State Changes / Permissions / Cost-Budget / Compliance / Happy Path / Failure-Edge Cases / Tests-Evals / Documentation / Owning Issue / Build-Defer-Reject / Rationale`.

## Hidden-gap checklist
Every domain review must test at least:
- permission denied, suspended/invited/unverified states
- empty, stale, contradictory and partial data
- quota/rate-limit/expired credentials/provider outage
- model outage/invalid schema/evaluator disagreement/budget stop
- duplicates/incorrect merge/split/recovery
- cancel/retry after partial commit/idempotency collision
- locale/timezone/currency/date boundaries
- plan downgrade below seats/usage/data volume
- payment redirect/webhook mismatch, duplicate/out-of-order events
- CRM conflicts/deletions/sync loops
- suppression after scheduled work exists
- account/workspace deletion with billing/audit/retention dependencies
- browser permission revoked/Desktop offline/version mismatch/deep-link tampering
- source policy changes after acquisition
- stale/poisoned/contradictory/deleted memory
- AI recommendation without adequate evidence
- incorrect business status/geography from source
- natural-language job attempting to exceed source/purpose/spend policy
- contact discovered but not legally/policy eligible for requested channel
- unknown recipient class (corporate vs sole trader/individual)
- policy version expires between scheduled job runs
- multi-location account returned multiple times by overlapping geography/source work
- absence signal created from missing data rather than verified absence

## Control rule
A feature idea can be added quickly, but it is not considered planned until it has an owner and maps through this matrix. Non-launch work must be explicitly `DEFERRED` with rationale and extension point rather than forgotten.