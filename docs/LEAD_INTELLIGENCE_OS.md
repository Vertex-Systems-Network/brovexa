# Brovexa Lead Intelligence Operating System

Status: **Planning Only**

Linear: ABD-243, ABD-249, ABD-250, ABD-251, ABD-221, ABD-222.

## Canonical model
Account/Business = organization; Location = branch/site; Contact = approved business/person contact context; Evidence = source material; Signal = observed event/condition; Opportunity = evidence-backed service/problem hypothesis; Lead = actionable commercial pursuit; Deal = qualified sales opportunity after workspace-defined acceptance.

A Lead references canonical objects rather than copying business/contact facts.

## Lead identity and duplicate semantics
A Lead is unique by commercial pursuit context, not merely by company. The same Business may legitimately have multiple Leads over time or for materially different service opportunities, but duplicates must be controlled.

Before create/promote, evaluate:
- same Business/Location
- overlapping ServiceDefinition/Opportunity
- same active lifecycle window
- current owner/team/territory
- existing Deal/open Lead
- nurture/suppressed state
- source/ResearchJob attribution

Possible outcomes:
`CREATE_NEW`, `ATTACH_TO_EXISTING`, `REOPEN_OR_REACTIVATE`, `CREATE_SEPARATE_PURSUIT`, `REVIEW_DUPLICATE`, `BLOCK`.

No source/import/agent may create parallel duplicate Leads without this gate.

## Lead creation sources
Brovexa ResearchJobs/LeadCandidates, manual promotion/entry, browser extension, CSV/XLSX, API/webhook, CRM sync, public-site inbound/demo forms, customer-authorized first-party signals and partner/referral connectors.

Every Lead stores creation source/type, originating ResearchJob/Opportunity/evidence links, creator/agent/version and creation reason code.

## Candidate/qualification gate
Dimensions:
- canonical entity identity confidence
- ICP/company/market fit
- enabled ServiceDefinition/problem fit
- explicit intent vs inferred need
- signal/evidence quality/freshness
- urgency/timing
- potential value
- contactability/reachability
- geography/territory
- decision/buying-role availability
- compliance/suppression/channel eligibility
- negative/disqualifying evidence
- duplicate/existing pursuit state

Workspace chooses threshold behavior: Opportunity only / LeadCandidate / Review Queue / Lead creation for internal workflow. Auto-create never means auto-contact.

## Canonical lifecycle categories
Workspace display stages map to stable canonical categories so analytics remain comparable:

- `CANDIDATE`
- `RESEARCHING`
- `QUALIFIED`
- `DISQUALIFIED`
- `READY_FOR_REVIEW`
- `ASSIGNED`
- `CONTACT_READY`
- `OUTREACH_APPROVED`
- `CONTACTED`
- `ENGAGED`
- `MEETING_DISCOVERY`
- `DEAL`
- `PROPOSAL`
- `WON`
- `LOST`
- `NURTURE`
- `SUPPRESSED`

Workspace may add sub-stages, labels and ordering but each active stage maps to one canonical category/version.

## Transition guards
Every transition is a server-authorized command and writes immutable `LeadStageTransition + Activity + AuditEvent` atomically.

Examples:
- Candidate → Qualified requires configured qualification gates.
- Qualified → Contact Ready requires applicable contact data/verification criteria.
- Contact Ready → Outreach Approved requires current ContactEligibility and human/policy approval.
- Any active state → Suppressed is always allowed when a valid suppression event occurs and cancels/blocks incompatible pending outbound actions.
- Suppressed → active pursuit cannot occur automatically; requires suppression eligibility change under policy/review.
- Lost/Disqualified → Nurture/Reactivated requires reason + allowed reactivation condition.
- Lead → Deal requires workspace Deal acceptance criteria; a CRM-side stage alone cannot bypass Brovexa transition rules.

Invalid transitions return actionable reason codes, not silent coercion.

## Lead status vs stage vs priority
Do not overload one status field:
- **Stage** = lifecycle position.
- **Operational status** = Active / OnHold / AwaitingReview / Blocked / Archived.
- **Priority** = Hot / High / Medium / Watch / Low or workspace bands.
- **Compliance/contact state** = separate canonical eligibility/suppression projections.

## Lead workspace
Header: account/location, owner/team, stage/status/priority, score/components, top opportunity/service, evidence confidence/freshness, contactability/compliance, next action, last/next activity.

Views: Overview; Why This Lead/Evidence; Signals; Opportunities; Contacts/Buying Committee; Research; Tasks/Activities; Outreach; Notes/Attachments; CRM Sync; Score History; Audit/Compliance.

## Qualification model
`QualificationFramework` is versioned and workspace-configurable.

A framework contains dimensions, required/optional gates, scoring/rules, disqualifiers, missing-data behavior, manual overrides and review policy. `LeadQualification` is immutable per evaluation attempt and records evidence/input snapshot, dimension outcomes, reasons, rule/agent version, confidence and reviewer.

Possible outcomes: `QUALIFIED`, `NOT_QUALIFIED`, `NEEDS_RESEARCH`, `NEEDS_REVIEW`, `DISQUALIFIED`.

Manual override requires permission/reason and does not erase the original result.

## Lead scoring
Score history is immutable. A ScoreSnapshot stores:
- ScoreModel version
- normalized overall score
- components: ICP fit, service fit, signal/intent, urgency/recency, value, evidence, reachability, contactability/compliance, strategic fit, negative/risk penalties
- exact Fact/Signal/Opportunity inputs and freshness
- calculation time
- reason/explanation codes
- model/rule versions

Current displayed score is a projection of the latest applicable snapshot. A model change creates a new score version; it does not rewrite history.

## Priority bands and SLA
Priority can be rule-derived or manually pinned under permissions. SLA/aging rules can use stage, priority, owner/team, source, service, business hours/timezone and compliance blocks.

A blocked/policy-awaiting Lead should not be treated as salesperson neglect in SLA analytics.

## Smart lists / audiences
`LeadListDefinition` supports static or dynamic criteria across canonical fields, geo/taxonomy, signal/score/stage/status, owner, activity, freshness, source/job, service, contactability and policy state.

Dynamic membership is derived/rebuildable. Export/outreach still re-checks policy at action time.

Examples: Hot Today; Support Hiring + Expansion; RFP/Tender; Re-research Due; Missing Buyer; Stale 30d; Nurture Reactivated; Compliance Review; specific territory/service/job.

## Ownership and routing
`RoutingRuleSet` is versioned. Strategies:
- manual
- named-account ownership
- geography/territory
- industry/service specialization
- account owner affinity
- language/timezone
- round robin
- weighted capacity/workload
- lead value/priority
- fallback queue

Routing order/conflict semantics are explicit. Deterministic rules run before AI recommendation. Assignment uses an atomic claim/lease or transaction so concurrent workers do not double-assign.

Every assignment stores rule/version/reason and validity. Reassignment preserves history.

## Territories
Territory definitions reference canonical GeoArea/custom territory IDs and may add industry/service/account constraints. Overlap resolution uses explicit precedence rather than nondeterministic matching.

## Buying committee
Canonical roles: economic buyer, champion, operational owner, evaluator/end user, procurement, finance, IT/security/legal/compliance and workspace custom roles.

`LeadBuyingRoleCandidate` links a role to Contact/Person/department candidate with source/evidence, title/function, confidence, freshness and channel policy. A predicted persona without an identified person remains a role gap, not a fake contact.

## AI Lead Copilot
Capabilities:
- explain Why this lead / Why now
- summarize verified changes since previous review
- identify missing qualification/evidence/contact/buying-role fields
- propose bounded re-research
- recommend service/offer/proof points/objections
- recommend next best action
- propose task/follow-up
- detect staleness/contact job change
- compare score versions and explain movement
- prepare meeting brief and post-meeting update from authorized data
- propose nurture/reactivation
- draft outreach subject to current eligibility and human review

Every recommendation records evidence/context IDs, agent/model/prompt version, confidence, estimated cost where applicable and acceptance/rejection feedback.

## Next-best-action contract
Action types include `RESEARCH`, `VERIFY`, `ENRICH`, `REVIEW`, `ASSIGN`, `WAIT`, `NURTURE`, `CREATE_TASK`, `DRAFT_EMAIL`, `CALL_TASK`, `MANUAL_SOCIAL_TASK`, `MEETING_PREP`, `PROPOSAL_TASK`, `DISQUALIFY_PROPOSAL`, `REACTIVATE_PROPOSAL`.

Recommendation includes preconditions, why, expected information/commercial gain, evidence, cost/credits, expiry and prohibited conditions. Server validates action again on execution.

## Tasks and activities
Task types: research, verify, enrich, review, call, email review/send, manual social, meeting prep/follow-up, proposal, approval, compliance and CRM cleanup.

Task state is separate from Lead stage. Completing an email task does not automatically mark Contacted unless an actual approved OutreachRecord exists.

Activity timeline is append-only domain history: stage/assignment/score/qualification changes, evidence additions, tasks, notes, approved outreach, response, meeting, CRM sync and outcome.

## Nurture/watch
`NurtureRule` conditions may include date, funding, hiring, branch opening, RFP, technology change, new buyer, score threshold, contact change or custom SignalDefinition.

Background monitoring creates a ReactivationCandidate; it does not silently move a Lead to active. Re-evaluate entity freshness, qualification, suppression/contactability and duplicate Deal state before reactivation.

## Re-research
Re-research compiles a bounded ResearchJob/WorkUnit linked to the Lead and exact research gaps. It respects current source policy, budget and freshness, and reuses research memory to avoid unnecessary repeats. New evidence may create new Score/Qualification/Opportunity versions; historical state remains.

## CRM/import synchronization
Provider-neutral mapping with:
- canonical↔provider IDs
- per-field authority `BROVEXA / PROVIDER / MANUAL_LOCK / LATEST_VERIFIED / REVIEW`
- stage mapping separate from canonical lifecycle
- idempotent webhook/poll/import events
- conflict queue
- reconciliation cursor
- delete/archive semantics
- suppression/opt-out propagation where required
- no sync loops

Provider CRM cannot overwrite verified evidence/history or bypass Lead transition guards. Missing/out-of-order webhooks reconcile from provider state.

Candidate connectors remain HubSpot, Salesforce, Pipedrive, Zoho and others prioritized by demand/API/license.

## Inbound
Public/demo/signup/referral/first-party inbound enters through entity matching + dedupe. Inbound consent/relationship evidence is stored where relevant, but inbound status does not bypass suppression or unrelated-channel rules.

## Deal conversion
Deal creation requires workspace acceptance criteria such as confirmed discovery/meeting, commercial need, value/owner or explicit manual acceptance. Deal references Lead/Business/Opportunity; lead remains historical source.

Won/Lost stores reason codes, value/currency/date where known and attribution. Reopening a lost Deal is a controlled state transition, not a new duplicate unless a genuinely new pursuit exists.

## Attribution
Trace:
`Source/Connector → ResearchJob → Evidence → Signal → Opportunity → Lead → Activity/Campaign → Deal → Outcome`.

Multi-touch attribution model is versioned; never claim causation solely because a source appeared earlier in time.

## Feedback/evals
Capture accepted/rejected lead recommendations, qualification corrections, bad contacts, inaccurate signals, reactivation outcomes, meeting outcomes and win/loss reasons.

Feedback feeds offline eval/calibration datasets under governance. Production agent/routing/scoring behavior does not silently self-modify.

## Dashboards
Lead Inbox; hot/new; pipeline; conversions/time-to-stage; aging/stale; source/job quality; signal→lead; service performance; territory/owner; AI acceptance; contactability; nurture/reactivation; win/loss; research/credit cost per qualified Lead/Deal; blocked/policy-review counts.

## Compliance invariants
Suppression/contact eligibility/jurisdiction/purpose/permissions are checked at action time, not only Lead creation time. Bulk actions/API/AI cannot bypass. A policy change can invalidate pending outreach approvals/tasks without deleting Lead history.

## Gate
Lead implementation waits for ABD-243/ABD-215 and explicit owner development authorization. Physical schema is governed by `CANONICAL_DATA_MODEL.md`; agent actions by `AI_AGENT_MEMORY_OS.md`; jurisdiction/contact rules by `JURISDICTION_OUTREACH_POLICY.md`.