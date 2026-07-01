CREATE TABLE "sohoa_app"."metadata_export_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"columns" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "metadata_export_presets_name_idx" ON "sohoa_app"."metadata_export_presets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "metadata_export_presets_active_idx" ON "sohoa_app"."metadata_export_presets" USING btree ("id") WHERE "sohoa_app"."metadata_export_presets"."deleted_at" IS NULL;