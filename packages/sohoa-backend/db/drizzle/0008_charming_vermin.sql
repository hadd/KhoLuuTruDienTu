ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "image_offset_x_percent" smallint;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "image_offset_y_percent" smallint;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "image_rotation_degrees" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "image_stamps" jsonb;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "text_offset_x_percent" smallint;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "text_offset_y_percent" smallint;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "text_rotation_degrees" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD COLUMN "text_stamps" jsonb;