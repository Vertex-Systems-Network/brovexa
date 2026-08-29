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

Signals may map to configurable services: BPO/support, sales/lead generation, HR/recruitment ops, finance/back-office, IT/helpdesk, AI/automation, web/ecommerce, marketing/SEO/content, data/research, localization, procurement/operations, partnerships/channel, consulting or custom services.

## Gate

Ontology is versioned and extensible. New sources/types map to canonical definitions rather than forcing schema redesign. Implementation waits for M00/ABD-248 approval.