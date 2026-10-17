-- WEB-063 preview-only; may roll back solely while no inspection records
-- exist. Never discard budget provenance after records were inserted.
-- Transactional ACCESS EXCLUSIVE lock closes the race between the
-- historical-evidence check and the ALTER/DROP operations. A concurrent
-- writer either commits before this precondition check or waits until it
-- finishes; its rows cannot appear between validation and destructive DDL.
SET LOCAL lock_timeout = '2000ms';
--> statement-breakpoint
LOCK TABLE public.website_inspection_runs IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.website_inspection_runs LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back validated website budget columns with evidence records.'
      USING ERRCODE='23514', CONSTRAINT='website_legacy_budget_rollback_requires_empty';
  END IF;
END;
$$;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  DROP CONSTRAINT website_runs_budget_check;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  DROP CONSTRAINT website_runs_retention_check;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  ADD CONSTRAINT website_runs_retention_check CHECK (
    retention_ttl_seconds IS NULL OR retention_ttl_seconds >= 0
  );
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  ALTER COLUMN retention_ttl_seconds DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  DROP COLUMN max_pages,
  DROP COLUMN max_response_bytes,
  DROP COLUMN timeout_ms;
