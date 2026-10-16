-- WEB-038: durable, tenant-scoped idempotency for canonical retention work.
-- Each receipt is persisted in the same transaction that purges expired rows.
CREATE TABLE website_live_retention_work_receipts (
  work_unit_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  max_rows smallint NOT NULL,
  deleted_count smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_live_retention_work_id_check
    CHECK (work_unit_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  CONSTRAINT website_live_retention_bounds_check
    CHECK (max_rows BETWEEN 1 AND 500 AND deleted_count BETWEEN 0 AND max_rows)
);
--> statement-breakpoint
CREATE INDEX website_live_retention_workspace_idx
  ON website_live_retention_work_receipts (workspace_id, created_at, work_unit_id);
--> statement-breakpoint
CREATE FUNCTION brovexa_internal.prevent_website_live_retention_receipt_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Live retention work receipts are immutable.'
    USING ERRCODE='23514', CONSTRAINT='website_live_retention_immutable_guard';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER website_live_retention_receipts_immutable
  BEFORE UPDATE ON website_live_retention_work_receipts
  FOR EACH ROW EXECUTE FUNCTION brovexa_internal.prevent_website_live_retention_receipt_update();