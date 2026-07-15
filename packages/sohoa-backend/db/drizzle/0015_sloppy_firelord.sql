DROP INDEX IF EXISTS "sohoa_app"."idx_retention_periods_name";--> statement-breakpoint
ALTER TABLE "sohoa_app"."retention_periods" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "sohoa_app"."retention_periods" DROP COLUMN IF EXISTS "description";
