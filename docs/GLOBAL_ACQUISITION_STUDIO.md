# Brovexa Global Acquisition Studio

Status: **Planning Only**

Linear: ABD-242, ABD-245, ABD-246, ABD-247, ABD-248.

## Product

The Acquisition Studio converts a user goal into an editable structured, policy-aware, budgeted and resumable ResearchJob. It is not an unrestricted scraper.

## Creation modes

Guided Builder; AI Builder (natural language → editable structured filters); saved template; clone; import targets; continuous monitor.

## Guided steps

Objective → Geography → Industry/Niche → Business Filters → Digital Filters → Contact Target → Signals → Sources → Research Depth → Quality → Output → Schedule → Budget → Preflight → Run.

## Objectives

Discover businesses/locations; verify websites; enrich company data; find approved business contacts/roles; detect jobs/hiring, RFI/RFP/RFQ/tenders, vendor/outsourcing/partner/distributor/franchise requests, funding/growth/expansion, technology changes, website/digital gaps, customer experience/reputation pain, operations/support/back-office needs, news/events/regulatory/security changes, competitor/market changes; generate service opportunities; create lead candidates; or compile a custom research condition.

## Geography

Canonical hierarchy supports World → UN region/subregion → country/area → administrative divisions → city/locality → postal/radius/polygon/custom territory.

Mappings/design inputs: UN M49, ISO 3166-1/3166-2 and a licensed/attributed maintained gazetteer such as GeoNames. Store aliases/native names and version renamed/moved areas. Do not assume every country has a `state` level.

Users can include/exclude multiple countries/states/cities, save territories, draw/import polygons, use radius search and schedule in target timezones.

## Industry/niche

Brovexa canonical taxonomy maps to ISIC Rev.5, NAICS 2022/version-ready revisions, NACE Rev.2.1, Google Places types and provider categories. Support user-defined niche/sub-niche keywords, exclusions and custom imported taxonomy.

## Business/digital/contact filters

Where supported: operating status, company type, headcount/revenue estimate, locations, age, languages, parent/subsidiary, verified domain; website yes/no/parked/broken, ecommerce, booking, forms/chat, multilingual, performance/accessibility/SEO indicators, observable technology/social/marketplace signals; company-only/generic contact/department/persona/title/seniority/buying-committee targets subject to policy.

Unknown data remains unknown.

## Signals

Select signal families/types, `AI recommend based on my Service Catalog`, custom SignalDefinition, lookback, freshness, confidence/evidence threshold and negative/disqualifying conditions. See `UNIVERSAL_SIGNAL_ONTOLOGY.md`.

## Sources

Modes: Auto/policy-aware, Quality-first, Cost-first, Freshness-first, Official-source-first, custom required/excluded sources.

Source classes: maps/local APIs, official registries/open data, industry directories, company first-party pages, careers/jobs, procurement/tender portals, news/search indexes, reviews/social only where authorized/allowed, technical/technology sources, funding/company intelligence, CRM/customer first-party data, licensed B2B data, CSV/manual/API/webhook and future partner/MCP adapters.

Each source needs separate SourceCapability + ConnectorPolicy. `Internet` is never a bypass source.

## Depth

Quick = discovery/minimal verify; Standard = entity + website + selected signals; Deep = broader multi-source verify/enrichment/opportunity; Continuous = baseline + scheduled/change-triggered refresh. Presets remain transparent/editable.

## Quality

Minimum sources/confidence; official-source requirement; verify entity/domain before deeper enrichment; contradictory/stale evidence rules; contact verification; optional evaluator pass before LeadCandidate.

## Budget/preflight

Limits for records, geographic work units, API/search/fetch/model calls, pages, tokens, Research Credits/cost, runtime and concurrency. Preflight explains compiled plan, source availability/skips, coverage estimate, costs, expected freshness/output and policy/unsupported combinations.

## Background execution

ResearchJob → plan → WorkUnits/shards → SourceTasks → normalize → entity resolution → enrichment → signals → verification → opportunity → LeadCandidate → commit/checkpoint.

Shard by geography/category/source/query/time/business batch. States: Draft, Preflight, Queued, Planning, Running, Paused, Rate Limited, Awaiting Review, Partial, Completed, Cancelled, Failed, Budget Stopped, Policy Blocked.

User can pause/resume/cancel. Jobs survive worker/model/context failure using durable checkpoints and idempotency. Agents cannot broaden geography, source, purpose or budget beyond the approved job without new preflight/review.

## Canonical `ResearchJob` contract

A job is versioned. Editing a running/scheduled job creates a new version; completed historical runs remain reproducible from their stored compiled plan.

### Identity and ownership
- `jobId`, `workspaceId`, `createdBy`, `version`
- name/description/tags
- source: guided / AI-compiled / template / clone / import / API
- parent template/job where applicable

### Objective
- one primary objective ID
- optional secondary outputs
- custom research question only as a structured compiler input, never a policy bypass

### Geography selector
- include/exclude `GeoArea` IDs
- include/exclude polygon/radius/postal/custom-list scopes
- boundary mode: exact admin area / radius / provider coverage approximation
- target/local timezone handling
- unresolved/ambiguous place names must be reviewed before run

### Taxonomy selector
- canonical industry nodes
- provider mappings resolved at compile time
- positive/negative free-text niche terms
- custom workspace taxonomy mappings
- include descendants toggle

### Business filters
- legal/operating status
- organization type/ownership where available
- size/headcount/revenue ranges with `unknown-policy`: include / exclude / separate bucket
- company age/date founded
- number of locations
- languages/markets
- parent/subsidiary/independent
- required/excluded known entities/domains

### Digital filters
- website state: unknown / none / active / parked / broken / redirect-only
- ecommerce/booking/forms/chat/app/API indicators
- multilingual/localization
- technical/observable stack
- SEO/indexability/performance/accessibility signals
- social/marketplace presence only from approved sources
- every filter has `unknown-policy` rather than treating missing data as false

### Contact target
- company-only
- generic business channels
- department
- persona/role family
- title keywords
- seniority
- buying-committee role
- verification minimum
- personal/contact enrichment disabled unless source + jurisdiction + workspace policy permits

### Signal selection
- SignalDefinition IDs/versions
- family include/exclude
- lookback window
- freshness requirement
- minimum observations/evidence sources
- positive/negative/disqualifying conditions
- sequence/compound conditions
- `AI recommend` produces an editable proposed selection tied to Service Catalog IDs

### Source plan
- routing mode: auto / quality / cost / freshness / official-first / custom
- required source classes/connectors
- excluded connectors
- maximum per-source spend/calls/concurrency
- fallback permission
- minimum official/first-party verification where configured

### Depth/quality
- Quick / Standard / Deep / Continuous preset ID + explicit overrides
- entity confidence threshold
- evidence confidence threshold
- contradiction behavior
- independent evaluator required boolean/risk rule
- contact verification age

### Output
- businesses/locations
- Evidence/Signals/Opportunities
- LeadCandidates
- report/export
- API/webhook destination
- CRM/list destination only if downstream source/policy allows
- output limits and fields are policy filtered

### Schedule
- once
- recurring calendar/timezone
- refresh-on-age
- condition watch
- trigger/webhook
- pause windows
- start/end/max occurrences
- missed-run/coalescing behavior

### Budget
- max candidate/verified records
- max WorkUnits/SourceTasks
- per-source/API/search/fetch/model calls
- pages/bytes/tokens
- Research Credits/currency budget
- runtime
- concurrency
- per-day/month workspace cap
- hard vs warning thresholds

### Compliance context
- research purpose
- intended downstream use
- target jurisdiction profile
- contact/outreach intent flag
- customer data/source attestation where applicable
- policy snapshot/version used at preflight

## Preflight result contract

Preflight is a required deterministic artifact before the first material execution of a job version. It returns:
- compiled job summary and normalized selections
- ambiguous/unresolved inputs
- source coverage by geography/objective/filter
- connectors selected/skipped + exact reasons
- expected unknown/missing fields
- policy blocks/review items
- estimated candidate/verified record range
- estimated API/search/model/credit/currency range
- estimated WorkUnits and concurrency
- freshness/verification expectation
- output restrictions
- warnings about high false-positive/false-negative risk
- explicit user acknowledgement requirements

A preflight estimate is a range, never presented as guaranteed coverage/cost.

## Filter semantics and edge cases

- `unknown` is a first-class value; absence of evidence is not automatically evidence of absence.
- `website = no` requires a verification strategy; one missing provider website field is insufficient.
- contradictory geography/entity data creates review/alternate candidates rather than silently choosing.
- radius/polygon and administrative-area overlap is deduplicated at canonical entity/location level.
- chain businesses may produce one Account with multiple Locations; user chooses account vs location granularity.
- moved/renamed/merged geographic areas preserve historical dataset/version references.
- provider category mismatch is recorded rather than coerced to a false canonical taxonomy match.
- source restrictions can remove fields from export even when internally observed.
- a scheduled job whose policy profile expires becomes `Policy Blocked` before the next source/outreach action.
- plan/entitlement downgrade can pause future work but does not delete historical canonical data automatically.

## Re-run / refresh semantics

`Refresh` does not blindly duplicate records. It evaluates canonical entity keys, prior evidence freshness, source-specific refresh requirements and requested signal windows. New observations append/supersede according to the evidence model. Historical score/opportunity versions remain auditable.

## Examples

- Antalya restaurants without websites.
- Dubai dental clinics hiring reception/support plus booking gaps.
- UK ecommerce firms hiring customer service.
- US manufacturers publishing RFP/RFQ/tenders.
- European firms in selected NACE classes changing technology stacks.
- Global SaaS firms after funding/new-country expansion.
- Existing CRM accounts due for signal/contact refresh.
- Natural-language custom condition compiled into visible structured filters.

## Gate

No source connector/acquisition/background execution is authorized until relevant M00 gates and explicit owner consent pass.