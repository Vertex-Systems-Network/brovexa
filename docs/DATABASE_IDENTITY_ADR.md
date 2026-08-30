# Brovexa — Database Access, Migrations & Identity Provider ADR v1.0

Status: **Planning Only — implementation choices prepared for final M00 review**

## Database access decision

**Initial choice: Drizzle ORM/query layer + Drizzle Kit generated/reviewed SQL migrations + explicit SQL escape hatch.**

Why:
- PostgreSQL is a first-class architecture dependency.
- Brovexa needs partial/expression/GIN/HNSW indexes, full-text expressions, pgvector, JSONB, constraints and explicit tuning.
- Drizzle stays close to SQL while preserving TypeScript safety.
- Generated migrations remain reviewable SQL and can include custom PostgreSQL statements.

Alternatives:
- **Prisma:** strong DX/Nest ecosystem, but advanced PostgreSQL/custom-extension features can still require extension packages, TypedSQL/raw SQL/custom migrations. Not selected initially.
- **Kysely:** excellent lower-level type-safe SQL builder; documented fallback if Drizzle obstructs complex SQL/migrations.
- **TypeORM:** not selected for a new Brovexa codebase merely because Nest integration exists.

## Migration rules

- production/staging use committed/reviewed migrations only
- schema push/direct synchronization only for disposable local experiments
- review locks/scans/destructive changes/backfills/defaults/rollback
- extensions enabled by explicit migrations/infra checks
- use expand → backfill → validate → contract for risky changes
- large index creation uses safe PostgreSQL deployment strategies where applicable
- destructive changes require deprecation or explicit data-loss approval
- migration checks against production-like schema fixtures

## Query/repository pattern

Avoid a generic `Repository<T>` that hides SQL.

Use domain-specific repositories/query modules, service-level transaction boundaries, typed read-model queries and domain services for invariants. Reviewed parameterized SQL is allowed in persistence modules.

## Tenant isolation

Every tenant-owned row carries/resolves to canonical workspace ownership.

Defense layers:
1. API/session/RBAC authorization
2. query/domain workspace scoping
3. DB constraints/composite uniqueness
4. cross-tenant adversarial tests
5. evaluate PostgreSQL Row Level Security as defense-in-depth during implementation spike

RLS never replaces app authorization. If enabled, worker/admin bypass roles are explicit/minimal/audited and pooled connections cannot leak tenant context.

## IDs

Prefer application-generated sortable standards-based UUID-class IDs (UUIDv7 or equivalent approved implementation) for high-write canonical objects. Provider IDs never become PKs. Human-readable reference codes are separate.

## Time and money

- store timezone-aware instants
- keep observed/published/fetched/verified timestamps distinct
- exact decimal/minor units + ISO currency for money
- Research Credits use versioned integer/decimal ledger units, not binary floats

## JSONB

Use JSONB for genuinely extensible heterogeneous metadata, not to avoid relational design. Fields needed for filters, integrity, joins, permissions, billing or lifecycle become typed columns/relations.

## Testing

- pure domain unit tests
- real PostgreSQL integration tests, not SQLite substitutes
- zero-to-latest and representative upgrade migration tests
- concurrency/idempotency tests for Lead/WorkUnit/webhook/ledger paths
- query-plan/performance fixtures as data grows
- cross-tenant tests
- restore/migration roll-forward/rollback tests

## Identity provider candidates

Brovexa keeps canonical User/Workspace/Membership/RBAC independent from authentication vendor IDs.

### WorkOS AuthKit — preferred enterprise validation candidate
Strengths: passkeys/MFA, enterprise SSO direction, OAuth application model for web/mobile/desktop/CLI-style flows, alignment with Enterprise roadmap.

Validate extension PKCE ergonomics, pricing, organization mapping, hosted/custom UI limits, export/migration and region requirements.

### Clerk — fast multi-client candidate
Strengths: native/browser-extension guidance, passkeys, strong frontend DX and organization primitives.

Validate Native API security/abuse implications, enterprise roadmap/pricing and lock-in.

### Auth0 — mature enterprise candidate
Validate native PKCE, organizations, MFA/passkeys, SSO, pricing and extension UX.

## Identity selection dimensions

- security maturity
- Web/Desktop/browser-extension OIDC compatibility
- Authorization Code + PKCE
- verification/recovery
- MFA/passkeys
- SAML/OIDC/SCIM roadmap
- invitations/org flows
- session/device revocation/audit
- abuse protection
- API/webhook reliability
- projected pricing
- data residency
- export/migration
- custom UX/localization

Provider user/org IDs remain external mappings. Brovexa Workspace/Membership/RBAC/entitlements/suppression stay canonical.

## Decision status

- Drizzle + reviewed SQL migrations: **LOCKED baseline unless implementation spike finds a blocker**
- Kysely: fallback
- Prisma: not initial choice
- PostgreSQL RLS: spike/defense-in-depth decision pending
- WorkOS AuthKit: preferred validation candidate
- Clerk/Auth0: comparison candidates
- exact identity provider: ADR/Human Decision before auth implementation