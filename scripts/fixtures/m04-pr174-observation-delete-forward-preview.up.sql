-- WEB-071 QA-09 — SCRATCH-ONLY candidate, NOT globally reserved migration 0028.
-- Original PR174 0018 and official ledger must remain byte-for-byte unchanged.
-- Block standalone child deletion while its assessed/review parent exists.
-- FK ON DELETE CASCADE from a legitimately deleted parent is allowed because
-- PostgreSQL has removed the parent row by the time its child DELETE runs.
CREATE FUNCTION brovexa_internal.guard_website_observation_parent_scoped_delete()
RETURNS trigger LANGUAGE plpgsql AS $m04_web071$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.website_inspection_runs AS parent
    WHERE parent.id=OLD.inspection_id AND parent.workspace_id=OLD.workspace_id
  ) THEN
    RAISE EXCEPTION 'Delete website observations by deleting their scoped inspection parent.'
      USING ERRCODE='23514', CONSTRAINT='website_observations_parent_scoped_delete_guard';
  END IF;
  RETURN OLD;
END;
$m04_web071$;
--> statement-breakpoint
CREATE TRIGGER website_observations_parent_scoped_delete_guard
  BEFORE DELETE ON public.website_capability_observations
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.guard_website_observation_parent_scoped_delete();
--> statement-breakpoint
-- WEB-072: TRUNCATE does not fire row-level DELETE triggers; block standalone
-- child-table TRUNCATE at statement level, while parent DELETE FK CASCADE
-- remains unchanged. No TRUNCATE privileges or table data are modified here.
CREATE FUNCTION brovexa_internal.guard_website_observation_truncate()
RETURNS trigger LANGUAGE plpgsql AS $m04_web072$
BEGIN
  RAISE EXCEPTION 'Truncating website capability observations would orphan assessed evidence.'
    USING ERRCODE='23514', CONSTRAINT='website_observations_truncate_guard';
END;
$m04_web072$;
--> statement-breakpoint
CREATE TRIGGER website_observations_truncate_guard
  BEFORE TRUNCATE ON public.website_capability_observations
  FOR EACH STATEMENT EXECUTE FUNCTION brovexa_internal.guard_website_observation_truncate();
