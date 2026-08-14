DO $$ BEGIN
  CREATE TYPE "sohoa_app"."disposal_appraisal_document_type" AS ENUM('PL2', 'PL3', 'MINUTES_COUNCIL', 'MINUTES_DESTRUCTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."disposal_catalog_document_drafts" (
	"catalog_id" uuid NOT NULL,
	"document_type" "sohoa_app"."disposal_appraisal_document_type" NOT NULL,
	"content_json" jsonb NOT NULL,
	"docx_storage_key" text,
	"source_hash" text,
	"generated_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disposal_catalog_document_drafts_pkey" PRIMARY KEY("catalog_id","document_type")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_catalog_document_drafts" ADD CONSTRAINT "disposal_catalog_document_drafts_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_catalog_document_drafts" ADD CONSTRAINT "disposal_catalog_document_drafts_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disposal_catalog_document_drafts_catalog_id" ON "sohoa_app"."disposal_catalog_document_drafts" ("catalog_id");
