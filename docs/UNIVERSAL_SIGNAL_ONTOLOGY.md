# Brovexa Universal Signal & Opportunity Ontology

Status: **Planning Only**

Linear: ABD-248, ABD-220, ABD-221.

## Model

`SignalDefinition` describes what to detect. `SignalObservation` records an evidence-backed occurrence/condition. `Opportunity` interprets one or more observations against a workspace Service Catalog. `Lead` is a separately qualified commercial pursuit.

Each observation stores entity, definition/version, evidence/source, dates, first/last seen, geography, explicit-vs-inferred, polarity/magnitude, confidence, freshness/decay, source quality, model/rule version, contradictions and verification state.

## Extensible signal families

### Corporate lifecycle
Formation/registration/status; rename/rebrand; ownership/parent/subsidiary; merger/acquisition/divestiture; insolvency/closure; relocation; branches/locations/franchises opening or closing.

### Growth & finance
Funding/grants/debt/investment; valuation; IPO/listing; public revenue/profit/growth changes; capex/budget/investment announcements.

### Workforce & organization
Job posts/hiring velocity; layoffs; headcount; departments; leadership changes; promotions/job changes; skills; seasonal hiring; recruitment vendor need.

### Procurement & explicit demand
RFI/RFP/RFQ; tenders/bids; procurement notices; vendor/supplier/outsourcing/agency/consultant/subcontractor search; partner/distributor/reseller/franchise requests; contract awards/renewals/expiry where public/authorized.

### Product/market/commercial
Launches; pricing; new segment/country/market; expansion; partnership/alliance; reseller/channel/distributor; import/export; marketplace/ecommerce launch.

### Technology/digital transformation
CRM/ERP/helpdesk/ecommerce/cloud/analytics/AI/security technology adoption/removal/migration; automation/digital transformation; app/API/integration; website rebuild.

### Website/digital presence
No/parked/broken site; TLS/DNS; outdated/mobile/performance/accessibility issues; missing/broken form/chat/booking/ecommerce; conversion friction; multilingual gaps; local/SEO/indexability/structured-data/social/listing gaps.

### Customer experience/reputation
Review/rating and complaint trends; slow response/support backlog; booking/checkout/returns/refunds/shipping/stock/service pain; public sentiment/mentions; support pressure.

### Operations/capacity
Facilities/warehouses; logistics/supply-chain; inventory/order growth; document/data processing; billing/accounting; scheduling/dispatch; back-office; call-center/after-hours/multilingual capacity.

### Sales/GTM
SDR/BDR hiring; lead-gen; outbound/inbound/ABM; CRM hygiene/enrichment; appointment setting; list-building; territory expansion; partner/channel; event follow-up; dormant pipeline.

### BPO/support
Customer/technical support, helpdesk, calls, reception, appointments, order/ecommerce/marketplace operations, moderation, retention, lawful reminders, 24/7/multilingual support.

### Back-office/BPO
Data entry/cleansing/enrichment, documents, transcription, translation/localization, research, catalog data, AP/AR/bookkeeping operations, payroll admin, HR/recruitment ops, procurement admin and other lawful administrative services subject to sector controls.

### Security/risk/resilience
Public breach/incident, cyber hiring, vulnerability, fraud risk, outage/disaster/continuity, certification/compliance initiative.

### Regulatory/public record
Licenses/permits, certifications, inspection, recalls, public fines/sanctions/litigation/regulatory actions, policy/regulation/deadline changes.

### Property/facilities
Lease/relocation, permits, fit-out, office/store/factory/warehouse/data-center opening, renovation/expansion, acquisition/disposal.

### Events/media/community
Conference/exhibition, sponsorship, webinar, speaking, award, press/news, podcast/interview, public social/community/competitor mention and content trends.

### Competitive/market
Competitor product/feature/pricing, funding, hiring, partnerships, expansion, positioning, evidenced customer movement, consolidation/new entrant and public review themes.

### First-party/inbound
Customer-authorized website/key-page visits, forms/demo/pricing interest, content downloads, replies, meetings, product/trial usage, support request, CRM changes and renewal/churn signals.

### Custom future signal
Natural-language condition compiles into structured subject, condition/event, sources, evidence requirements, geography, time window, threshold, cadence, confidence and action. Material definitions require review.

## Operators

Occurrence, equality/range, changed value, count/rate/trend, absence, event sequence, AND/OR/NOT, threshold crossing, time-since, entity relationship and geospatial conditions.

## Freshness, negatives and inference

Each definition owns freshness/decay. Explicit demand and inferred need remain separate. Negative/disqualifying evidence can reduce/close opportunities. A new observation never becomes an explicit request just because AI finds it commercially interesting.

## Opportunity mapping

Signals map to the versioned Service Catalog (`SERVICE_TAXONOMY_REGISTRY.md`). Opportunities reference canonical service ID + service version + mapping reason; custom workspace services are explicitly registered.

## Canonical `SignalDefinition` contract

Each version stores:
- `signalDefinitionId`, semantic version, lifecycle state
- family/subfamily and stable machine key
- display labels/translations
- subject type: Business / Location / Domain / Contact / Product / Market / Technology / Job / Tender / other canonical entity
- observation type: event / state / absence / trend / sequence / relationship / threshold / geospatial
- explicitness classification: `EXPLICIT_DEMAND`, `DIRECT_FACT`, `INFERRED_NEED`, `RISK`, `DISQUALIFIER`, `FIRST_PARTY_INTENT`
- conditions/operators/thresholds
- evidence requirements by source class and count
- minimum source quality/verification
- geography applicability
- lookback and observation window
- freshness/decay function
- recurrence/deduplication key
- contradiction/negative-evidence rules
- minimum confidence/review threshold
- allowed detection engines: deterministic rule / parser / AI extractor / model classifier / change detector / first-party event
- prohibited sources/uses
- mapped ServiceDefinition IDs + default fit weights
- default recommended actions, if any
- eval suite/version and owner

A definition can be Draft, Review, Active, Deprecated or Blocked. Historical observations retain the definition version used at detection time.

## Canonical `SignalObservation` contract

Each observation stores:
- immutable observation ID
- subject canonical ID(s)
- signal-definition ID/version
- normalized value/magnitude/unit
- observedAt, occurredAt/validFrom/validTo where known
- firstSeenAt/lastSeenAt
- source/evidence IDs
- extraction/detection method and model/rule version
- explicitness/polarity
- confidence and evidence-quality components
- freshness/decay score
- verification state: Candidate / Verified / Contradicted / Superseded / Expired / Rejected
- contradiction and supporting observation links
- geography/context
- job/run/provenance links
- policy/storage state

Observations are append/version based. A later source update may supersede an observation; it does not erase historical evidence silently.

## Evidence requirements

Different signal types require different proof strength:
- `EXPLICIT_DEMAND` such as an RFP/vendor request should point to the actual allowed tender/request source and relevant dates/issuer.
- `DIRECT_FACT` such as branch opening should use first-party/official or corroborated evidence where available.
- `INFERRED_NEED` may combine weaker observations but must remain visibly inferred.
- `ABSENCE` signals (for example `no website`) require positive search/verification methodology and uncertainty handling; a blank provider field alone is insufficient.
- high-impact contact/outreach recommendations can require independent evaluator review even when the signal itself is verified.

## Deduplication and event identity

The engine derives a signal-event fingerprint from subject + definition + normalized event key + time window + source semantics. Multiple sources can corroborate one logical observation cluster rather than creating duplicate commercial events. Separate repeated real-world events remain distinct.

## Contradiction handling

Examples:
- Source A says `closed`; official registry says `active` → do not collapse to one fact; mark contradiction and source authority.
- Job posting removed → does not prove role filled; observation may become stale/expired.
- Website unavailable once → not immediately `broken website`; require retry/temporal rule.
- Review complaint → not automatically company-wide operational failure; use trend/minimum-volume rules.

Contradictions may lower confidence, pause Opportunity promotion or require review.

## Freshness and decay

SignalDefinitions specify one of:
- fixed TTL
- linear/exponential decay
- event-validity range
- `until superseded`
- `continuous current-state verification`

Lead/Opportunity score reads the current decayed value while historical score versions retain the original inputs.

## Compound signals

A `CompoundSignalDefinition` may reference child definitions with AND/OR/NOT, sequence and time constraints, for example:

`new_location_opened` AND (`receptionist_hiring` OR `support_hiring`) AND `booking_gap` within 120 days.

Compound results remain explainable by listing every child observation and missing/negative condition.

## Custom signal compiler

Natural-language custom signals produce a **draft structured definition**, never directly executable unrestricted browsing instructions. Compiler output includes:
- normalized subject/event
- selected operators and thresholds
- proposed sources
- evidence requirements
- time/geography
- refresh schedule
- expected cost/coverage
- policy risks
- service mappings
- generated test examples

Material/high-cost/custom source definitions require human review before Active state.

## Opportunity promotion

A SignalObservation does not automatically become an Opportunity. Promotion checks:
1. service is enabled in workspace;
2. required positive evidence exists;
3. disqualifiers/negative evidence;
4. freshness;
5. account/industry/geography fit;
6. evidence confidence;
7. source/contact policy implications;
8. duplication with existing Opportunity/Lead.

Opportunity keeps the exact signal/evidence IDs used so `Why now?` is reproducible.

## Initial launch vs future extensibility

Launch must support the full ontology contract and custom-definition extension point, but not every theoretical source/detector must ship on day one. Unsupported detectors are explicitly `DEFERRED`/unavailable rather than silently approximated by AI.

## Gate

Ontology is versioned and extensible. New sources/types map to canonical definitions rather than forcing schema redesign. Implementation waits for M00/ABD-248 approval.