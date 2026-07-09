CREATE TYPE "sohoa_app"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_config_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_config_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"status" "sohoa_app"."notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"action_url" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_config_channels" ADD CONSTRAINT "notification_config_channels_config_id_notification_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."notification_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_config_roles" ADD CONSTRAINT "notification_config_roles_config_id_notification_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."notification_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_config_roles" ADD CONSTRAINT "notification_config_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD CONSTRAINT "notification_configs_created_by_id_user_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD CONSTRAINT "notification_configs_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "sohoa_app"."notifications"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" ADD CONSTRAINT "notifications_recipient_id_user_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_config_channels_unique" ON "sohoa_app"."notification_config_channels" USING btree ("config_id","channel");--> statement-breakpoint
CREATE INDEX "notification_config_channels_channel_idx" ON "sohoa_app"."notification_config_channels" USING btree ("channel");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_config_roles_unique" ON "sohoa_app"."notification_config_roles" USING btree ("config_id","role_id");--> statement-breakpoint
CREATE INDEX "notification_config_roles_role_idx" ON "sohoa_app"."notification_config_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "notification_configs_type_active_idx" ON "sohoa_app"."notification_configs" USING btree ("notification_type","active") WHERE "sohoa_app"."notification_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_configs_dedupe_active_unique" ON "sohoa_app"."notification_configs" USING btree ("dedupe_key") WHERE "sohoa_app"."notification_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notification_deliveries_channel_status_idx" ON "sohoa_app"."notification_deliveries" USING btree ("channel","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "sohoa_app"."notifications" USING btree ("recipient_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "sohoa_app"."notifications" USING btree ("recipient_id","created_at");