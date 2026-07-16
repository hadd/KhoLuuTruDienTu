-- Free-form warehouse tree: drop level catalog; storage unit = capacity IS NOT NULL
-- Idempotent so local DBs that already applied this under the old 0019_* tag can re-run safely.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'sohoa_app'
      AND table_name = 'physical_warehouse_items'
      AND column_name = 'level_id'
  ) THEN
    EXECUTE 'UPDATE "sohoa_app"."physical_warehouse_items" SET "level_id" = NULL';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" DROP CONSTRAINT IF EXISTS "physical_warehouse_items_level_id_physical_warehouse_levels_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "sohoa_app"."idx_physical_warehouse_items_level_id";--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" DROP COLUMN IF EXISTS "level_id";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."physical_warehouse_levels";
