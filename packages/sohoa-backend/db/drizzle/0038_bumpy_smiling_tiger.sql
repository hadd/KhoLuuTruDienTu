CREATE TYPE "sohoa_app"."archive_field_type" AS ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'REFERENCE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_reference_source" AS ENUM('FOND', 'INVENTORY', 'RETENTION_PERIOD', 'DOSSIER_TYPE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_submission_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'PENDING_ARCHIVE';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'ARCHIVE_REJECTED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'ARCHIVED';--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_field_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"field_type" "sohoa_app"."archive_field_type" NOT NULL,
	"reference_source" "sohoa_app"."archive_reference_source",
	"depends_on_field_key" varchar(100),
	"is_required" boolean DEFAULT false NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "sohoa_app"."archive_submission_status" NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reject_notes" text,
	"field_values" jsonb NOT NULL,
	"field_config_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_submitted_by_user_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_field_configs_field_key" ON "sohoa_app"."archive_field_configs" USING btree ("field_key");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_dossier" ON "sohoa_app"."archive_submissions" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_status" ON "sohoa_app"."archive_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_submitted_at" ON "sohoa_app"."archive_submissions" USING btree ("submitted_at");