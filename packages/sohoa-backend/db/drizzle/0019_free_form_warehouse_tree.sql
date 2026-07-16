-- Free-form warehouse tree: drop level catalog; storage unit = capacity IS NOT NULL

-- Ensure former bottom-level items keep capacity (no-op if already set).
-- Clear level references before dropping FK/column/table.
UPDATE "sohoa_app"."physical_warehouse_items" SET "level_id" = NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" DROP CONSTRAINT "physical_warehouse_items_level_id_physical_warehouse_levels_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "sohoa_app"."idx_physical_warehouse_items_level_id";--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" DROP COLUMN "level_id";--> statement-breakpoint
DROP TABLE "sohoa_app"."physical_warehouse_levels";
