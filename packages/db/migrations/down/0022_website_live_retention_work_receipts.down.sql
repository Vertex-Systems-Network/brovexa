DROP TRIGGER IF EXISTS website_live_retention_receipts_immutable ON website_live_retention_work_receipts;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.prevent_website_live_retention_receipt_update();
--> statement-breakpoint
DROP TABLE IF EXISTS website_live_retention_work_receipts;