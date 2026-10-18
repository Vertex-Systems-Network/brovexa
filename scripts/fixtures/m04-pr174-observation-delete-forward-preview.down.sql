-- WEB-071 SCRATCH-ONLY candidate DOWN. No data or journal rewrites;
-- rolls back only the experimental child-delete trigger and function.
DROP TRIGGER website_observations_parent_scoped_delete_guard
  ON public.website_capability_observations;
--> statement-breakpoint
DROP FUNCTION brovexa_internal.guard_website_observation_parent_scoped_delete();
