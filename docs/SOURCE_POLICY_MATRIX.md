# Brovexa — Initial Source Policy & Acquisition Governance Matrix

Status: **M00 policy design — connector enablement remains disabled**

## ConnectorPolicy contract
Every enabled connector/version must record access method, policy/license version, allowed/prohibited purposes, allowed fields, transient/storage rights, cache/retention TTL, canonicalization rule, attribution, export/redistribution rights, personal-data restrictions, geographic limits, robots/crawl rules where relevant, quotas/concurrency, cost, refresh/deletion requirements, credential/security rules, fallback behavior, review state, owner and next review date.

States: `APPROVED`, `APPROVED_WITH_LIMITS`, `TRANSIENT_ONLY`, `REVIEW_REQUIRED`, `BLOCKED`, `EXPIRED`.

## Initial decisions

### Google Places API (New)
Role: local-business discovery/verification, not a persistent Brovexa CRM dataset.

Policy: `APPROVED_WITH_LIMITS / TRANSIENT_ONLY` for Google content. Persist Google `place_id` mapping/provenance where allowed; independently verify durable canonical facts where appropriate. Preserve required Google Maps attribution/display obligations. Never bulk-export Google content as Brovexa-owned records.

### Brave Search API
Role: web/news discovery and candidate URL finding.

Policy: `TRANSIENT_ONLY` by default. Storage requires a Brave plan explicitly granting storage rights. Prefer durable evidence from the underlying permitted first-party/official source rather than storing search-result payloads as permanent truth.

### GeoNames main gazetteer
Role: global geography registry input/aliases.

Policy: `APPROVED_WITH_LIMITS`, with CC BY attribution/source/version metadata. Prefer versioned dump ingestion for canonical geo registry. Do not treat GeoNames as sole legal authority for borders/admin status.

Postal-code datasets: `REVIEW_REQUIRED` per country/dataset due third-party/country-specific rights.

### Public first-party company websites
Role: website verification, business facts, services, locations, public business contact channels, careers and announcements.

Policy: `APPROVED_WITH_LIMITS` through bounded SSRF-safe fetchers, source/robots/terms/purpose controls, rate limits and minimum necessary evidence retention. Robots handling follows the standardized Robots Exclusion Protocol, but robots alone is not a license to store/reuse content. Authentication/paywall/anti-bot barriers are not bypassed.

### Official registries, government/open-data, licensing, procurement/tender portals
Policy: `REVIEW_REQUIRED` per registry/dataset/portal/license. No global blanket approval. Prefer official APIs/feeds/open-data exports when available.

### Job sources
Company career pages follow first-party rules. Third-party job boards are `REVIEW_REQUIRED`; official APIs/licensed feeds/authorized access only. No generic job-board scraper.

### Review/reputation platforms
`REVIEW_REQUIRED`; official/licensed access and provider-specific attribution/retention/privacy rules. Derived signals remain provenance-linked and may require minimum-content retention.

### Social/community platforms
Generic automated scraping is `BLOCKED` by default. Enable only provider-specific official/user-authorized integrations after policy review.

### Licensed B2B providers
`REVIEW_REQUIRED` per commercial contract, field, territory, retention, export/resale and personal-data rights. Provider identifiers remain mappings.

### Customer-authorized CRM / first-party integrations
`APPROVED_WITH_LIMITS` with valid scopes/purpose, field ownership, retention/deletion, suppression and sync-conflict controls.

### Customer CSV/XLSX/manual/API imports
`APPROVED_WITH_LIMITS` with user authorization/attestation, validation, data classification, dedupe, suppression/privacy and provenance.

### Browser-extension manual capture
Save as `EvidenceCandidate`, not truth. Record source URL/user/time/minimum necessary content; run source-policy/evidence verification before canonical promotion.

### Automation that bypasses provider APIs, anti-bot systems, authentication or platform terms
`BLOCKED`.

## Canonicalization
`SourceRecord/TransientResult → normalized candidate → policy check → entity resolution → independent verification where required → Evidence/Fact/Signal`.

Provider data never silently becomes canonical truth. Brovexa facts preserve source/provenance and can be corrected/superseded.

## Storage classes
- `TRANSIENT`
- `REFERENCE_ONLY`
- `NORMALIZED_FACT`
- `EVIDENCE_MINIMAL`
- `SOURCE_CONTENT` only with explicit rights

## Web acquisition baseline
Validate scheme/host/IP/redirects; block private/link-local/metadata networks; enforce source/robots policy; cap bytes/time/redirects/types; never execute fetched page instructions as agent instructions; sanitize display; record fetch status/time/hash; use domain quotas/concurrency; honor retention/deletion.

## Outreach/contact gate
Discovery of a contact route is separate from permission to use it. Channel use requires provenance, business-vs-personal classification, jurisdiction/purpose, freshness, channel eligibility and suppression state.

## Fail closed
Unknown policy/storage/personal-data/geography/provider eligibility becomes `REVIEW_REQUIRED` or `POLICY_BLOCKED`, never an AI assumption. Natural-language ResearchJobs cannot override this.