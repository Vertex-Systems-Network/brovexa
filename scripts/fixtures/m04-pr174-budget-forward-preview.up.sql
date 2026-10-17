-- WEB-063 QA-09 PREVIEW ONLY — NOT A RESERVED OR DEPLOYABLE MIGRATION.
-- Valid only for PR174's original 0018 history with zero legacy fixture rows.
-- Integration owner must separately reserve a forward migration number and
-- review any populated legacy data before adopting this candidate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM brovexa_internal.schema_migrations
    WHERE id='0018_website_inspection_evidence'
      AND checksum='877b161f7e95f58feb3ef00941721bf76488b546e50a8ab7d7da723a9fc17b12'
  ) THEN
    RAISE EXCEPTION 'This preview is only for exact unmodified PR174 migration 0018 history.'
      USING ERRCODE='23514', CONSTRAINT='website_legacy_budget_original_history_required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.website_inspection_runs LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot infer page/byte/timeout limits for historical website evidence; manual reconciliation required.'
      USING ERRCODE='23514', CONSTRAINT='website_legacy_budget_provenance_required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.website_capability_observations LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot alter website evidence budget while legacy observations exist.'
      USING ERRCODE='23514', CONSTRAINT='website_legacy_budget_provenance_required';
  END IF;
END;
$$;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  ADD COLUMN max_pages smallint NOT NULL,
  ADD COLUMN max_response_bytes integer NOT NULL,
  ADD COLUMN timeout_ms integer NOT NULL;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  ALTER COLUMN retention_ttl_seconds SET NOT NULL;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  ADD CONSTRAINT website_runs_budget_check CHECK (
    max_pages BETWEEN 1 AND 5 AND max_response_bytes BETWEEN 1 AND 1000000
    AND timeout_ms BETWEEN 100 AND 30000
  );
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  DROP CONSTRAINT website_runs_retention_check;
--> statement-breakpoint
ALTER TABLE public.website_inspection_runs
  ADD CONSTRAINT website_runs_retention_check CHECK (
    retention_ttl_seconds BETWEEN 1 AND 31536000 AND deletion_required
  );
