ALTER TYPE "sohoa_app"."archive_reference_source" ADD VALUE IF NOT EXISTS 'PHYSICAL_BOTTOM_ITEM';
--> statement-breakpoint
CREATE TYPE "sohoa_app"."dossier_physical_placement_status" AS ENUM('ACTIVE', 'MOVED', 'REMOVED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."dossier_physical_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"physical_item_id" uuid NOT NULL,
	"location_root_id" uuid,
	"archive_submission_id" uuid,
	"units" integer DEFAULT 1 NOT NULL,
	"status" "sohoa_app"."dossier_physical_placement_status" NOT NULL,
	"placed_by" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_physical_item_id_physical_warehouse_items_id_fk" FOREIGN KEY ("physical_item_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_location_root_id_physical_warehouse_items_id_fk" FOREIGN KEY ("location_root_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE set null ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_archive_submission_id_archive_submissions_id_fk" FOREIGN KEY ("archive_submission_id") REFERENCES "sohoa_app"."archive_submissions"("id") ON DELETE set null ON UPDATE restrict;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dossier_physical_placements_dossier_id" ON "sohoa_app"."dossier_physical_placements" USING btree ("dossier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dossier_physical_placements_physical_item_id" ON "sohoa_app"."dossier_physical_placements" USING btree ("physical_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dossier_physical_placements_status" ON "sohoa_app"."dossier_physical_placements" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dossier_physical_placements_active_dossier" ON "sohoa_app"."dossier_physical_placements" USING btree ("dossier_id") WHERE "status" = 'ACTIVE';
