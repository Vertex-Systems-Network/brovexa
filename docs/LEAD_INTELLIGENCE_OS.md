# Brovexa Lead Intelligence Operating System

Status: **Planning Only**

Linear: ABD-243, ABD-249, ABD-250, ABD-251, ABD-221, ABD-222.

## Canonical model

Account/Business = organization; Location = branch/site; Contact = approved business/person contact record; Evidence = source material; Signal = observed event/condition; Opportunity = evidence-backed service/problem hypothesis; Lead = actionable commercial pursuit; Deal = qualified sales opportunity after workspace-defined acceptance.

A Lead references canonical objects rather than copying them.

## Lead creation

Sources: Brovexa ResearchJobs/LeadCandidates, manual promotion/entry, browser extension, CSV/XLSX, API/webhook, CRM sync, Brovexa public-site inbound/demo forms, customer-authorized first-party inbound signals and partner/referral connectors.

Candidate gate checks entity identity, ICP/market fit, service/problem fit, signals/evidence, urgency, value, contactability, geography/territory, compliance/suppression, duplicates/existing deals and negative evidence.

## Lifecycle

Default configurable canonical progression:
Candidate → Researching → Qualified/Disqualified → Ready for Review → Assigned → Contact Ready → Outreach Approved → Contacted → Engaged → Meeting/Discovery → Deal → Proposal → Won/Lost/Nurture/Suppressed.

Workspace custom stages map to canonical categories; historical transitions are immutable/audited.

## Lead workspace

Header: account, owner/team, stage, priority, score/components, top opportunity/service, evidence confidence/freshness, contactability/compliance, next action and activity dates.

Views: Overview; Why This Lead/Evidence; Signals; Opportunities; Contacts/Buying Committee; Research; Tasks/Activities; Outreach; Notes; CRM Sync; Score History; Audit/Compliance.

## Qualification & scoring

Configurable qualification dimensions include ICP/company fit, problem/service fit, explicit intent, inferred need, urgency, value, evidence, reachability, decision-maker availability, compliance and negative evidence.

Score is componentized/versioned; old scores are never overwritten. AI can explain/propose; production changes require evaluation/calibration.

## Lists and routing

Smart/dynamic lists across fields, geography, industry, signals, score, stage, owner, activity and freshness. Example queues: Hot Today, New Website-less, Support Hiring + Expansion, RFP/Tender, Re-research Due, Missing Decision Maker, Stale, Nurture Reactivated, Compliance Review.

Assignment modes: manual, round robin, sales territory, service specialization, account-owner affinity, language/timezone, workload and named accounts. Deterministic routing rules win; AI can recommend in ambiguous cases.

## Buying committee

Map economic buyer, champion, operational owner, evaluator/end user, procurement, finance, IT/security/legal/compliance stakeholders as relevant. Each contact candidate has evidence, role/title/function, confidence, freshness and channel policy.

## AI Lead Copilot

Capabilities: explain why lead exists; summarize changes; find research gaps; re-research within budget; recommend roles/committee; recommend service/offer and evidence; next-best-action; proposed tasks/follow-ups; stale/job-change detection; nurture reactivation; score-change explanation; meeting prep and outcome suggestions from authorized context.

Recommendations never override suppression, ownership rules or required approval. Accept/reject feedback becomes eval/calibration data, not silent production self-training.

## Tasks & nurture

Tasks: research, verify, enrich, review, call, email review/send, manual social, meeting prep/follow-up, proposal, approval, compliance, CRM cleanup. Track SLAs, aging and next-action due date.

Nurture retains reactivation conditions such as funding, hiring, branch opening, RFP, technology change, calendar date or custom signal. Monitors may propose reactivation.

## CRM/import

Provider-neutral adapter and ProviderMapping. Per-field authority options: Brovexa, CRM, manual lock, latest verified or review/merge. Prevent loops/duplicates; webhooks plus reconciliation; explicit stage/custom-field/contact/account/lead/deal mapping. Candidate CRMs for later evaluation: HubSpot, Salesforce, Pipedrive, Zoho, prioritized by demand/API/licensing.

## Attribution & dashboards

Trace Source → ResearchJob → Evidence → Signal → Opportunity → Lead → Activity/Campaign → Deal → outcome.

Dashboards: Lead Inbox, hot/new, pipeline, conversions/time-to-stage, aging/stale, source/job quality, signal-to-lead, service performance, territory/owner, AI recommendation acceptance, contactability, win/loss and research cost per qualified lead/deal.

## Gate

Lead implementation waits for ABD-243/ABD-215 and explicit owner development authorization.