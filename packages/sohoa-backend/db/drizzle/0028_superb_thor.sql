CREATE TABLE "sohoa_app"."download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"export_type" varchar(32) NOT NULL,
	"scope" varchar(32) NOT NULL,
	"resource_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"apply_watermark" boolean DEFAULT false NOT NULL,
	"placement_id" uuid,
	"success" boolean NOT NULL,
	"error_message" text,
	"ip" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_profiles" ADD COLUMN "download_password_encrypted" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_profiles" ADD COLUMN "download_password_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."download_logs" ADD CONSTRAINT "download_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "download_logs_user_id_idx" ON "sohoa_app"."download_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "download_logs_created_at_idx" ON "sohoa_app"."download_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "download_logs_user_created_idx" ON "sohoa_app"."download_logs" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "sohoa_app"."fonds" DROP COLUMN "zip_password_encrypted";--> statement-breakpoint
ALTER TABLE "sohoa_app"."fonds" DROP COLUMN "zip_password_enabled";