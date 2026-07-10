CREATE TABLE "sohoa_app"."watermark_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text_enabled" boolean DEFAULT false NOT NULL,
	"text_content" text,
	"text_opacity" smallint DEFAULT 30 NOT NULL,
	"text_position" varchar(32) DEFAULT 'center' NOT NULL,
	"text_size_percent" smallint DEFAULT 20 NOT NULL,
	"image_enabled" boolean DEFAULT false NOT NULL,
	"image_opacity" smallint DEFAULT 30 NOT NULL,
	"image_position" varchar(32) DEFAULT 'center' NOT NULL,
	"image_size_percent" smallint DEFAULT 30 NOT NULL,
	"active_image_asset_id" uuid,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."watermark_image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"raster_storage_key" text,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_configs" ADD CONSTRAINT "watermark_configs_active_image_asset_id_watermark_image_assets_id_fk" FOREIGN KEY ("active_image_asset_id") REFERENCES "sohoa_app"."watermark_image_assets"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_configs" ADD CONSTRAINT "watermark_configs_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_image_assets" ADD CONSTRAINT "watermark_image_assets_uploaded_by_id_user_profiles_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "watermark_image_assets_status_idx" ON "sohoa_app"."watermark_image_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "watermark_image_assets_created_at_idx" ON "sohoa_app"."watermark_image_assets" USING btree ("created_at");