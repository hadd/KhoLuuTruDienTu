-- notification_configs: merge junction tables into array columns
ALTER TABLE "sohoa_app"."notification_configs" ADD COLUMN IF NOT EXISTS "channels" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD COLUMN IF NOT EXISTS "role_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'sohoa_app'
      AND table_name = 'notification_config_channels'
  ) THEN
    UPDATE "sohoa_app"."notification_configs" AS nc SET
      "channels" = COALESCE((
        SELECT array_agg(ncc."channel" ORDER BY ncc."channel")
        FROM "sohoa_app"."notification_config_channels" AS ncc
        WHERE ncc."config_id" = nc."id"
      ), '{}'),
      "role_ids" = COALESCE((
        SELECT array_agg(ncr."role_id" ORDER BY ncr."role_id")
        FROM "sohoa_app"."notification_config_roles" AS ncr
        WHERE ncr."config_id" = nc."id"
      ), '{}');
  END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "sohoa_app"."notification_configs_dedupe_unique";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" DROP COLUMN IF EXISTS "dedupe_key";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."notification_config_channels";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."notification_config_roles";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" DROP COLUMN IF EXISTS "entity_type";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" DROP COLUMN IF EXISTS "entity_id";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" DROP COLUMN IF EXISTS "payload";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."notification_deliveries";--> statement-breakpoint
DROP TYPE IF EXISTS "sohoa_app"."notification_delivery_status";--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_host" varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_port" integer DEFAULT 587 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_secure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_user" varchar(255);--> statement-breakpoint
DROP INDEX IF EXISTS "sohoa_app"."email_sender_configs_key_unique";--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" DROP COLUMN IF EXISTS "key";
