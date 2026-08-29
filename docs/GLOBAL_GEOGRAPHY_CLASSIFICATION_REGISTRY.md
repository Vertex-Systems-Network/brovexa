# Brovexa — Global Geography & Classification Registry

Status: **Planning Only — canonical registry contract, not implementation authorization**

## Purpose
Brovexa must provide complete country/state/province/city/niche targeting without hardcoded provider lists. Saved ResearchJobs, Leads, territories and analytics must survive administrative/taxonomy renames and source revisions.

Stable Brovexa IDs are canonical. ISO/M49/GeoNames/NAICS/NACE/ISIC/provider codes are versioned external mappings, never primary identity.

## Initial reference inputs
- **UN M49** — World/region/subregion/intermediate-region/country-or-area statistical hierarchy and ISO mappings. M49 groupings are statistical and must not be presented as Brovexa political claims.
- **ISO 3166-1 / 3166-2** — current country and principal subdivision code mappings, imported/versioned because the ISO Maintenance Agency updates names/codes.
- **GeoNames** — initial attributed global gazetteer input for populated places, deeper ADM levels, aliases and timezones. Its worldwide/country extracts, alternate names, hierarchy and daily modifications/deletions make incremental registry maintenance possible; it is enrichment, not sole legal/political authority.
- **ISIC Revision 5** — global economic-activity reference.
- **NACE Rev. 2.1** — current European economic-activity mapping for 2025+ statistics, with revision correspondence tables.
- **NAICS 2022** — current North American/U.S. baseline; architecture remains ready for 2027 after the revision becomes official/current.

## Geography entities

### `GeoDatasetVersion`
Source/dataset/version, retrieval/effective/published dates, license/attribution, checksum/import artifact, SourcePolicy reference and lifecycle `Staged / Validated / Published / Rejected / Superseded`.

### `GeoArea`
Stable Brovexa UUID with:
- kind: WORLD / REGION / SUBREGION / COUNTRY_AREA / ADM1 / ADM2 / ADM3 / ADM4 / ADM5 / CITY / LOCALITY / POSTAL_AREA / CUSTOM_TERRITORY
- canonical display name
- country/area context
- active/historical/special-context metadata
- centroid/bbox/boundary reference only where sourced
- validFrom/validTo

### `GeoAlias`
Name, language/script, type (official/preferred/short/alternative/historical/colloquial/transliteration), validity and source/version. Autocomplete resolves aliases to canonical IDs.

### `GeoHierarchyEdge`
Parent/child + relation `ADMINISTRATIVE / STATISTICAL / DEPENDENCY / GEOGRAPHIC / CUSTOM_SALES_TERRITORY`, local level/label, source/version/validity.

Do not use one universal `state` field: local labels may be state, province, emirate, governorate, prefecture, department, region, district, etc. One place may also have different statistical vs administrative hierarchies.

### `GeoCodeMapping`
GeoArea ID + code system (M49, ISO3166-1 alpha2/alpha3, ISO3166-2, GeoNames, NUTS/LAU, provider/custom) + external code + relation `EXACT / BROADER / NARROWER / RELATED / AMBIGUOUS / RETIRED` + source/version/validity.

### `GeoBoundaryRef`
Optional independently licensed/versioned geometry reference. Never invent a boundary when an approved dataset is absent.

### `GeoChangeEvent`
Rename, code change, split, merge, parent change, activation/deactivation, boundary change or source correction. Historical jobs retain their original snapshot while UI may resolve successors/predecessors.

## Country/state/city UX contract
World → statistical region/subregion → country/area → locally named admin levels → city/locality.

Supports:
- include/exclude single or multiple areas
- select descendants / all-except
- radius
- polygon/bbox
- postal scope where licensed
- saved/custom sales territory
- native/local names and translated labels

Ambiguous duplicate place names require parent/country disambiguation. Natural-language location cannot silently choose an ambiguous place.

## Political/special cases
Brovexa records which dataset/hierarchy is being used and does not make independent sovereignty/border claims. Statistical, administrative, dependency and custom territory relationships remain distinct.

## Timezone
Use IANA timezone IDs as identities, not raw UTC offsets. `GeoAreaTimezone` may be one-to-many. Research schedules store an explicit timezone ID, especially for multi-timezone countries/territories.

## Postal data
Postal datasets are separate ConnectorPolicy/GeoDatasetVersion inputs because rights/coverage differ by country. Lack of postal coverage must not block country/admin/city/radius/polygon targeting.

## Classification entities

### `TaxonomyDatasetVersion`
Type/source: BROVEXA / ISIC / NACE / NAICS / provider/custom; version/effective/published dates/source/license/status.

### `TaxonomyNode`
Stable Brovexa UUID, dataset/version, external code, hierarchy level, label, description/explanatory-note reference, parent and lifecycle state.

### `TaxonomyAlias`
Common commercial niche names, synonyms, local-language labels and abbreviations. An alias never silently changes the formal source definition.

### `TaxonomyMapping`
Crosswalk relation `EXACT / BROADER / NARROWER / PARTIAL / RELATED / AMBIGUOUS / NO_MATCH`, with source/version/confidence/review state. Never assume crosswalks are one-to-one.

### `WorkspaceTaxonomyNode`
Namespaced custom niche/sub-niche nodes that may map to zero/many canonical/source nodes.

## Natural-language niche compilation
`cosmetic dentists in Antalya` resolves into canonical geography IDs + Brovexa niche nodes + relevant formal/provider mappings + keyword/exclusion clauses + mapping confidence. Ambiguous mappings are shown in preflight.

## Import/update pipeline
`Fetch approved dataset → Staged version → license/schema/checksum validation → normalize → hierarchy/referential checks → diff → classify adds/renames/splits/merges/deletes/mapping changes → review destructive/ambiguous changes → atomic publish → rebuild derived indexes → retain prior version → emit change events`.

GeoNames daily modifications can feed staging, but publication is controlled. ISO/UN/NACE/NAICS changes never mutate production taxonomy automatically.

## Invariants
- provider IDs never become canonical IDs
- hierarchy acyclic per relation/version
- every admin/city area has country/area context where applicable
- names are not globally unique
- retired codes remain historically resolvable
- source/version/attribution exists for imported mappings
- taxonomy mappings support one-to-many/many-to-one/ambiguity
- saved ResearchJobs keep canonical IDs plus relevant mapping/dataset snapshots
- destructive source changes do not rewrite history
- search/geospatial indexes are rebuildable derivatives, not canonical truth

## Wave A coverage target
- complete versioned country/area + UN region baseline
- ISO principal subdivisions
- global populated places/deeper admin/aliases/timezones from approved attributed gazetteer pipeline
- Brovexa niche taxonomy + ISIC Rev.5 mappings
- NACE Rev.2.1 Europe mappings
- NAICS 2022 North America mappings
- provider-category mappings needed by actually enabled discovery connectors

Postal/boundary/provider-specific enrichments expand later without schema changes.

## Gate
Before implementation, confirm exact source artifacts/licenses/attribution; approve these canonical objects in ABD-211; approve import/storage topology in ABD-214; and add dataset-change tests to ABD-252/253.