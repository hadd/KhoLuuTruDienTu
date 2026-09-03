CREATE TYPE "sohoa_app"."disposal_appraisal_document_type" AS ENUM('PL2', 'PL3', 'MINUTES_COUNCIL', 'MINUTES_DESTRUCTION');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_evaluation_decision" AS ENUM('DESTROY', 'KEEP');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_member_history_action" AS ENUM('CREATE', 'ADD', 'REMOVE', 'UPDATE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_member_position_role" AS ENUM('CHAIR', 'SECRETARY', 'MEMBER');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_member_representation_type" AS ENUM('LEADERSHIP', 'ARCHIVE_DEPT', 'SPECIALIST_DEPT', 'OTHER');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_review_result" AS ENUM('APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_proposal_catalog_status" AS ENUM('DRAFT', 'PENDING_SUBMIT', 'SUBMITTED', 'AWAITING_FEEDBACK', 'APPROVED', 'REJECTED', 'DESTROYED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_proposal_item_source" AS ENUM('EXPIRED', 'EXPIRING_SOON', 'DUPLICATE', 'WAREHOUSE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."duplicate_detection_rule_key" AS ENUM('DOSSIER_NAME', 'DOSSIER_CODE', 'DOCUMENT_METADATA_SIMILARITY', 'FILE_NAME_STRICT');--> statement-breakpoint
CREATE TYPE "sohoa_app"."group_member_role" AS ENUM('leader', 'editor', 'qc1', 'qc2', 'qc3', 'qc4', 'qc5');--> statement-breakpoint
CREATE TYPE "sohoa_app"."retention_duration_unit" AS ENUM('YEAR', 'MONTH', 'DAY');--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_appraisal_documents" (
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
CREATE TABLE "sohoa_app"."disposal_appraisal_export_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"document_type" "sohoa_app"."disposal_appraisal_document_type" NOT NULL,
	"run_number" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_catalog_document_drafts" (
	"catalog_id" uuid NOT NULL,
	"document_type" "sohoa_app"."disposal_appraisal_document_type" NOT NULL,
	"content_json" jsonb NOT NULL,
	"docx_storage_key" text,
	"source_hash" text,
	"generated_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disposal_catalog_document_drafts_catalog_id_document_type_pk" PRIMARY KEY("catalog_id","document_type")
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_catalog_pl3_content" (
	"catalog_id" uuid PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"old_decision" "sohoa_app"."disposal_council_evaluation_decision",
	"new_decision" "sohoa_app"."disposal_council_evaluation_decision" NOT NULL,
	"old_note" text,
	"new_note" text NOT NULL,
	"change_reason" text,
	"changed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_review_council_item_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"destroy_vote_count" integer DEFAULT 0 NOT NULL,
	"keep_vote_count" integer DEFAULT 0 NOT NULL,
	"participating_member_count" integer DEFAULT 0 NOT NULL,
	"concluded_decision" "sohoa_app"."disposal_council_evaluation_decision",
	"has_dissent" boolean DEFAULT false NOT NULL,
	"needs_chair_decision" boolean DEFAULT false NOT NULL,
	"chair_decision" "sohoa_app"."disposal_council_evaluation_decision",
	"chair_reason" text,
	"chair_decided_by" uuid,
	"chair_decided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_hidden_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_code" varchar(100) NOT NULL,
	"group_code" varchar(100),
	"description" varchar(255),
	"is_hidden" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_appraisal_documents" ADD CONSTRAINT "disposal_appraisal_documents_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_appraisal_documents" ADD CONSTRAINT "disposal_appraisal_documents_draft_exported_by_user_profiles_id_fk" FOREIGN KEY ("draft_exported_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_appraisal_documents" ADD CONSTRAINT "disposal_appraisal_documents_signed_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("signed_uploaded_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_appraisal_export_runs" ADD CONSTRAINT "disposal_appraisal_export_runs_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_appraisal_export_runs" ADD CONSTRAINT "disposal_appraisal_export_runs_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_catalog_document_drafts" ADD CONSTRAINT "disposal_catalog_document_drafts_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_catalog_document_drafts" ADD CONSTRAINT "disposal_catalog_document_drafts_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_catalog_pl3_content" ADD CONSTRAINT "disposal_catalog_pl3_content_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_catalog_pl3_content" ADD CONSTRAINT "disposal_catalog_pl3_content_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_item_id_disposal_proposal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "sohoa_app"."disposal_proposal_items"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_changed_by_user_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_outcomes" ADD CONSTRAINT "disposal_review_council_item_outcomes_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_outcomes" ADD CONSTRAINT "disposal_review_council_item_outcomes_item_id_disposal_proposal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "sohoa_app"."disposal_proposal_items"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_outcomes" ADD CONSTRAINT "disposal_review_council_item_outcomes_chair_decided_by_user_profiles_id_fk" FOREIGN KEY ("chair_decided_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_appraisal_documents_catalog_type_unique" ON "sohoa_app"."disposal_appraisal_documents" USING btree ("catalog_id","document_type");--> statement-breakpoint
CREATE INDEX "idx_disposal_appraisal_documents_catalog_id" ON "sohoa_app"."disposal_appraisal_documents" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_appraisal_export_runs_catalog_id" ON "sohoa_app"."disposal_appraisal_export_runs" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_catalog_document_drafts_catalog_id" ON "sohoa_app"."disposal_catalog_document_drafts" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_eval_history_council_id" ON "sohoa_app"."disposal_review_council_item_evaluation_history" USING btree ("council_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_eval_history_item_id" ON "sohoa_app"."disposal_review_council_item_evaluation_history" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_council_item_outcomes_council_item_unique" ON "sohoa_app"."disposal_review_council_item_outcomes" USING btree ("council_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_item_outcomes_council_id" ON "sohoa_app"."disposal_review_council_item_outcomes" USING btree ("council_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_metadata_hidden_fields_code" ON "sohoa_app"."metadata_hidden_fields" USING btree ("field_code","group_code");