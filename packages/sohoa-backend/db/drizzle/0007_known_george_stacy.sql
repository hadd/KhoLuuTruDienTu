CREATE TABLE "sohoa_app"."watermark_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"image_asset_id" uuid,
	"image_enabled" boolean DEFAULT false NOT NULL,
	"image_opacity" smallint DEFAULT 30 NOT NULL,
	"image_position" varchar(32) DEFAULT 'center' NOT NULL,
	"image_size_percent" smallint DEFAULT 30 NOT NULL,
	"text_enabled" boolean DEFAULT false NOT NULL,
	"text_content" text,
	"text_opacity" smallint DEFAULT 30 NOT NULL,
	"text_position" varchar(32) DEFAULT 'center' NOT NULL,
	"text_size_percent" smallint DEFAULT 20 NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "sohoa_app"."watermark_configs" CASCADE;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD CONSTRAINT "watermark_placements_image_asset_id_watermark_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "sohoa_app"."watermark_image_assets"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD CONSTRAINT "watermark_placements_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "watermark_placements_image_asset_id_idx" ON "sohoa_app"."watermark_placements" USING btree ("image_asset_id");--> statement-breakpoint
CREATE INDEX "watermark_placements_created_at_idx" ON "sohoa_app"."watermark_placements" USING btree ("created_at");