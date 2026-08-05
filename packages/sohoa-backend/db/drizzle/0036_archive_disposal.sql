CREATE TYPE "sohoa_app"."disposal_proposal_catalog_status" AS ENUM('DRAFT', 'PENDING_SUBMIT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DESTROYED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_proposal_item_source" AS ENUM('EXPIRED', 'EXPIRING_SOON', 'DUPLICATE', 'WAREHOUSE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."duplicate_detection_rule_key" AS ENUM('DOSSIER_NAME', 'HO_SO_ID', 'DOSSIER_CODE', 'FILE_NAME_SIZE');--> statement-breakpoint
CREATE TABLE "sohoa_app"."duplicate_detection_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_key" "sohoa_app"."duplicate_detection_rule_key" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"dossier_code_field_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_detection_rules_rule_key_unique" ON "sohoa_app"."duplicate_detection_rules" USING btree ("rule_key");--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_proposal_catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"catalog_date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" "sohoa_app"."disposal_proposal_catalog_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_proposal_catalogs_code_unique" ON "sohoa_app"."disposal_proposal_catalogs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_catalogs_status" ON "sohoa_app"."disposal_proposal_catalogs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_catalogs_created_by" ON "sohoa_app"."disposal_proposal_catalogs" USING btree ("created_by");--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_proposal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"dossier_id" uuid NOT NULL,
	"file_id" uuid,
	"source" "sohoa_app"."disposal_proposal_item_source" NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_proposal_items_catalog_dossier_file_unique" ON "sohoa_app"."disposal_proposal_items" USING btree ("catalog_id","dossier_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_items_catalog_id" ON "sohoa_app"."disposal_proposal_items" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_items_dossier_id" ON "sohoa_app"."disposal_proposal_items" USING btree ("dossier_id");--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_catalogs" ADD CONSTRAINT "disposal_proposal_catalogs_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_items" ADD CONSTRAINT "disposal_proposal_items_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_items" ADD CONSTRAINT "disposal_proposal_items_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_items" ADD CONSTRAINT "disposal_proposal_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
INSERT INTO "sohoa_app"."duplicate_detection_rules" ("rule_key", "is_enabled")
VALUES
  ('DOSSIER_NAME', true),
  ('HO_SO_ID', true),
  ('DOSSIER_CODE', true),
  ('FILE_NAME_SIZE', true)
ON CONFLICT ("rule_key") DO NOTHING;
