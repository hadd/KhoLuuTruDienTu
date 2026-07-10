CREATE TYPE "sohoa_app"."retention_duration_unit" AS ENUM('YEAR', 'MONTH', 'DAY');--> statement-breakpoint
ALTER TABLE "sohoa_app"."retention_periods" ADD COLUMN "duration_value" integer;--> statement-breakpoint
ALTER TABLE "sohoa_app"."retention_periods" ADD COLUMN "duration_unit" "sohoa_app"."retention_duration_unit";--> statement-breakpoint
ALTER TABLE "sohoa_app"."retention_periods" ADD COLUMN "is_permanent" boolean DEFAULT false NOT NULL;