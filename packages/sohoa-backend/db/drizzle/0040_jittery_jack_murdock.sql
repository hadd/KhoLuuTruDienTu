CREATE TYPE "sohoa_app"."disposal_council_member_history_action" AS ENUM('CREATE', 'ADD', 'REMOVE', 'UPDATE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_member_position_role" AS ENUM('CHAIR', 'SECRETARY', 'MEMBER');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_member_representation_type" AS ENUM('LEADERSHIP', 'ARCHIVE_DEPT', 'SPECIALIST_DEPT', 'OTHER');--> statement-breakpoint
CREATE TYPE "sohoa_app"."disposal_council_review_result" AS ENUM('APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_review_council_member_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"action" "sohoa_app"."disposal_council_member_history_action" NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"changed_by" uuid NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_review_council_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position_role" "sohoa_app"."disposal_council_member_position_role" NOT NULL,
	"representation_type" "sohoa_app"."disposal_council_member_representation_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_review_councils" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"catalog_id" uuid NOT NULL,
	"copied_from_council_id" uuid,
	"review_started_at" timestamp with time zone,
	"review_result" "sohoa_app"."disposal_council_review_result",
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_settings" (
	"id" uuid PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"council_review_enabled" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "access_password_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "access_password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" ADD COLUMN "password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" ADD COLUMN "file_password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_member_history" ADD CONSTRAINT "disposal_review_council_member_history_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_member_history" ADD CONSTRAINT "disposal_review_council_member_history_changed_by_user_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ADD CONSTRAINT "disposal_review_council_members_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ADD CONSTRAINT "disposal_review_council_members_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD CONSTRAINT "disposal_review_councils_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD CONSTRAINT "disposal_review_councils_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_settings" ADD CONSTRAINT "disposal_settings_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_disposal_council_member_history_council_id" ON "sohoa_app"."disposal_review_council_member_history" USING btree ("council_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_member_history_created_at" ON "sohoa_app"."disposal_review_council_member_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_review_council_members_council_user_unique" ON "sohoa_app"."disposal_review_council_members" USING btree ("council_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_review_council_members_council_id" ON "sohoa_app"."disposal_review_council_members" USING btree ("council_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_review_councils_code_unique" ON "sohoa_app"."disposal_review_councils" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_review_councils_catalog_id_unique" ON "sohoa_app"."disposal_review_councils" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_review_councils_created_by" ON "sohoa_app"."disposal_review_councils" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_files_dossier_id" ON "sohoa_app"."files" USING btree ("dossier_id");