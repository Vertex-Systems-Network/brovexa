# Brovexa — Canonical Service Taxonomy Registry

Status: **Planning Only**

Stable IDs prevent signal/opportunity/lead history from depending on display labels. Registry versioning is independent from translations/UI wording.

ID format: `svc.<family>.<service>`. Workspace services use `custom.<workspace-id>.<slug>` and may map to canonical IDs.

## Customer Experience — `svc.cx.*`
- `svc.cx.customer_support`
- `svc.cx.inbound_phone`
- `svc.cx.email_support`
- `svc.cx.live_chat`
- `svc.cx.social_messaging`
- `svc.cx.technical_support`
- `svc.cx.helpdesk_l1`
- `svc.cx.virtual_receptionist`
- `svc.cx.appointment_handling`
- `svc.cx.complaint_escalation`
- `svc.cx.retention_winback`
- `svc.cx.after_hours`
- `svc.cx.round_the_clock`
- `svc.cx.multilingual_support`

## Revenue Operations — `svc.rev.*`
- `svc.rev.lead_research`
- `svc.rev.list_building`
- `svc.rev.enrichment`
- `svc.rev.lead_qualification`
- `svc.rev.inbound_qualification`
- `svc.rev.appointment_setting`
- `svc.rev.sdr_support`
- `svc.rev.pipeline_reactivation`
- `svc.rev.event_followup`
- `svc.rev.partner_channel_ops`
- `svc.rev.crm_operations`
- `svc.rev.crm_hygiene`

## Ecommerce — `svc.commerce.*`
- `svc.commerce.order_management`
- `svc.commerce.order_support`
- `svc.commerce.returns_refunds_admin`
- `svc.commerce.catalog_operations`
- `svc.commerce.product_data`
- `svc.commerce.marketplace_operations`
- `svc.commerce.inventory_coordination`
- `svc.commerce.merchant_support`
- `svc.commerce.customer_messaging`

## Back Office — `svc.ops.*`
- `svc.ops.data_entry`
- `svc.ops.data_cleansing`
- `svc.ops.document_processing`
- `svc.ops.transcription`
- `svc.ops.virtual_assistance`
- `svc.ops.scheduling`
- `svc.ops.dispatch_coordination`
- `svc.ops.research_reporting`
- `svc.ops.procurement_admin`
- `svc.ops.vendor_admin`
- `svc.ops.real_estate_inquiry_admin`
- `svc.ops.hospitality_reservations`
- `svc.ops.guest_messaging`

## Finance Operations — `svc.finance.*`
- `svc.finance.accounts_payable_admin`
- `svc.finance.accounts_receivable_admin`
- `svc.finance.invoice_billing_support`
- `svc.finance.payment_reminder_admin` — lawful/policy-approved only
- `svc.finance.bookkeeping_support`
- `svc.finance.reconciliation_support`
- `svc.finance.expense_processing`
- `svc.finance.financial_data_preparation`

## HR & Recruitment — `svc.hr.*`
- `svc.hr.candidate_sourcing`
- `svc.hr.recruiting_coordination`
- `svc.hr.interview_scheduling`
- `svc.hr.candidate_admin`
- `svc.hr.hr_records_admin`
- `svc.hr.payroll_admin_support`
- `svc.hr.seasonal_workforce_ops`

## Data, Content & Localization — `svc.data.*`
- `svc.data.web_research`
- `svc.data.data_enrichment`
- `svc.data.classification_tagging`
- `svc.data.content_operations`
- `svc.data.translation`
- `svc.data.localization`
- `svc.data.multilingual_content_ops`
- `svc.data.content_moderation` — restricted/risk-profiled

## IT & Digital Operations — `svc.it.*`
- `svc.it.it_helpdesk`
- `svc.it.application_support`
- `svc.it.crm_admin`
- `svc.it.helpdesk_admin`
- `svc.it.website_operations`
- `svc.it.ecommerce_operations`
- `svc.it.integration_operations`
- `svc.it.data_operations`

## Adjacent services — `svc.adjacent.*`
Opportunity categories supported by the platform but distinct from default BPO delivery.
- `svc.adjacent.web_development`
- `svc.adjacent.ecommerce_development`
- `svc.adjacent.seo`
- `svc.adjacent.digital_marketing`
- `svc.adjacent.ai_automation`
- `svc.adjacent.software_integration`
- `svc.adjacent.recruitment_service`
- `svc.adjacent.consulting`
- `svc.adjacent.localization_service`

## ServiceDefinition schema
Each service stores canonical ID/version, family, display names/translations, description, lifecycle state, target personas/buying roles, eligible/restricted industries, typical problems, positive/negative signal mappings, evidence requirements, fit-scoring weights, delivery model metadata, compliance/risk flags and workspace overrides.

## Mapping examples
- support vacancies + expansion + response complaints → `svc.cx.customer_support`, `svc.cx.multilingual_support`, `svc.cx.after_hours`
- receptionist vacancy + new clinic + booking friction → `svc.cx.virtual_receptionist`, `svc.cx.appointment_handling`
- SDR hiring + territory expansion → `svc.rev.sdr_support`, `svc.rev.appointment_setting`, `svc.rev.lead_research`
- ecommerce growth + delivery/returns complaints → `svc.commerce.order_support`, `svc.commerce.returns_refunds_admin`
- repeated document/data hiring → `svc.ops.data_entry`, `svc.ops.document_processing`
- international expansion + language hiring → `svc.cx.multilingual_support`, `svc.data.localization`

Signal-to-service mappings are hypotheses; evidence and scoring still decide fit.

## Workspace overrides
Workspaces may enable/disable services, rename labels, attach value/pricing/delivery metadata, create custom services, change signal weights, restrict industries/geographies and set minimum evidence requirements.

## Versioning
Canonical IDs are immutable. Material semantic changes create a new service-definition version. Deprecated IDs remain resolvable for historical Opportunities/Leads and may point to a replacement.

Every Opportunity must reference service ID + service-definition version + evidence-backed mapping reason. AI may suggest a custom service draft but cannot silently create an unregistered production service.