-- Brovexa M04 QA-09 — operator-run READ-ONLY target-history audit.
-- This is an inspection template, NOT an executable migration.
-- Run only with separately authorized target DB access; never put a
-- DATABASE_URL, password, captured evidence or result rows in issue comments.
-- It deliberately has no DDL, DML, role elevation or transaction reset.
--
-- Key interpretation:
--   checkpoint canonical 0018:
--   7d2779e5dc2ad78de358ca013edf15af20165715ff326fb5c5cbefa4dfc82e67
--   original draft PR174 0018:
--   877b161f7e95f58feb3ef00941721bf76488b546e50a8ab7d7da723a9fc17b12
-- An unrecognized checksum requires a stop and exact applied-SQL audit.
-- A target with the draft checksum and *any* legacy inspection/observation
-- rows cannot use the preview budget compatibility migration (WEB-063).
-- Approved migration number, adapter choice and actual deploy lineage are
-- separate integration-owner decisions.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- First result: object existence. Stop if journal/table is absent:
SELECT current_database() AS inspected_database,
       to_regclass('brovexa_internal.schema_migrations') IS NOT NULL
         AS migration_journal_present,
       to_regclass('public.website_inspection_runs') IS NOT NULL
         AS inspection_table_present,
       to_regclass('public.website_capability_observations') IS NOT NULL
         AS observation_table_present;

-- Exact immutable applied history. No checksum update or journal insertion:
SELECT id, checksum
FROM brovexa_internal.schema_migrations
WHERE id LIKE '0018_%' OR id >= '0019_'
ORDER BY id;

-- Inspection budget / retention schema only (no customer values):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='website_inspection_runs'
  AND column_name IN ('max_pages','max_response_bytes','timeout_ms',
                      'retention_ttl_seconds','deletion_required')
ORDER BY column_name;

-- Relevant constraint metadata, including whether PostgreSQL validated it:
SELECT con.conname AS constraint_name, con.contype AS constraint_type,
       con.convalidated AS is_validated,
       pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid=con.conrelid
JOIN pg_namespace ns ON ns.oid=rel.relnamespace
WHERE ns.nspname='public'
  AND rel.relname='website_inspection_runs'
  AND con.conname IN ('website_runs_budget_check','website_runs_retention_check')
ORDER BY con.conname;

-- Counts only; do not export rows/URLs, subject identifiers or raw evidence:
SELECT
  (SELECT count(*) FROM public.website_inspection_runs)
    AS legacy_inspection_rows,
  (SELECT count(*) FROM public.website_capability_observations)
    AS legacy_observation_rows;

COMMIT;
