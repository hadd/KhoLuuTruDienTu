-- Purge soft-deleted configs before enforcing global unique dedupe_key
-- and dropping deleted_at (otherwise soft-deleted rows would resurface).
DELETE FROM "sohoa_app"."notification_configs" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DROP INDEX "sohoa_app"."notification_configs_dedupe_active_unique";--> statement-breakpoint
DROP INDEX "sohoa_app"."notification_configs_type_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "notification_configs_dedupe_unique" ON "sohoa_app"."notification_configs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_configs_type_active_idx" ON "sohoa_app"."notification_configs" USING btree ("notification_type","active");--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" DROP COLUMN "deleted_at";
