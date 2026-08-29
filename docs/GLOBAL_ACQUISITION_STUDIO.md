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

## Example jobs

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