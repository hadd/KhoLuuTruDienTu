DO $$ BEGIN
  CREATE TYPE "sohoa_app"."disposal_appraisal_document_type" AS ENUM('PL2', 'PL3', 'MINUTES_COUNCIL', 'MINUTES_DESTRUCTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."disposal_appraisal_documents" (
	"catalog_id" uuid NOT NULL,
	"document_type" "sohoa_app"."disposal_appraisal_document_type" NOT NULL,
	"draft_storage_key" text,
	"draft_exported_at" timestamp with time zone,
	"draft_exported_by" uuid,
	"signed_storage_key" text,
	"signed_uploaded_at" timestamp with time zone,
	"signed_uploaded_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."disposal_catalog_pl3_content" (
	"catalog_id" uuid PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."disposal_appraisal_export_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"document_type" "sohoa_app"."disposal_appraisal_document_type" NOT NULL,
	"run_number" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_appraisal_documents" ADD CONSTRAINT "disposal_appraisal_documents_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_appraisal_documents" ADD CONSTRAINT "disposal_appraisal_documents_draft_exported_by_user_profiles_id_fk" FOREIGN KEY ("draft_exported_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_appraisal_documents" ADD CONSTRAINT "disposal_appraisal_documents_signed_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("signed_uploaded_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_catalog_pl3_content" ADD CONSTRAINT "disposal_catalog_pl3_content_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_catalog_pl3_content" ADD CONSTRAINT "disposal_catalog_pl3_content_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_appraisal_export_runs" ADD CONSTRAINT "disposal_appraisal_export_runs_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_appraisal_export_runs" ADD CONSTRAINT "disposal_appraisal_export_runs_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "disposal_appraisal_documents_catalog_type_unique" ON "sohoa_app"."disposal_appraisal_documents" ("catalog_id", "document_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disposal_appraisal_documents_catalog_id" ON "sohoa_app"."disposal_appraisal_documents" ("catalog_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disposal_appraisal_export_runs_catalog_id" ON "sohoa_app"."disposal_appraisal_export_runs" ("catalog_id");
