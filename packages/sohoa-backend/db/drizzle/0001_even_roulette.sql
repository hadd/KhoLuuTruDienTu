CREATE TYPE "sohoa_app"."group_member_role" AS ENUM('leader', 'editor', 'qc1', 'qc2', 'qc3', 'qc4', 'qc5');--> statement-breakpoint
CREATE TYPE "sohoa_app"."assignment_status" AS ENUM('IN_PROGRESS', 'COMPLETED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."dossier_status" AS ENUM('NEW', 'OCR_PROCESSING', 'OCR_FAILED', 'READY_FOR_ENTRY', 'ENTRY_PROCESSING', 'WAITING_CHECKER_1', 'CHECKER_1_PROCESSING', 'CHECKER_1_REJECTED', 'WAITING_CHECKER_2', 'CHECKER_2_PROCESSING', 'CHECKER_2_REJECTED', 'APPROVED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."entity_type" AS ENUM('DOSSIER', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "sohoa_app"."worker_role" AS ENUM('MAKER', 'CHECKER_1', 'CHECKER_2');--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossier_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"role" "sohoa_app"."worker_role" NOT NULL,
	"assignee_id" uuid NOT NULL,
	"metadata_key" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" "sohoa_app"."assignment_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_size_kb" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"folder_path" varchar(500) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "sohoa_app"."entity_type" NOT NULL,
	"status" "sohoa_app"."dossier_status" DEFAULT 'NEW' NOT NULL,
	"reject_count" integer DEFAULT 0 NOT NULL,
	"last_reject_notes" text,
	"ocr_metadata_key" text,
	"current_metadata_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"folder_path" varchar(500) NOT NULL,
	"folder_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "sohoa_app"."group_member_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"round_number" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."workflow_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(50) NOT NULL,
	"from_status" "sohoa_app"."dossier_status",
	"to_status" "sohoa_app"."dossier_status",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD CONSTRAINT "dossier_assignments_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD CONSTRAINT "dossier_assignments_assignee_id_user_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "sohoa_app"."folders"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "sohoa_app"."folders"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "sohoa_app"."groups"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD CONSTRAINT "group_members_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."workflow_logs" ADD CONSTRAINT "workflow_logs_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."workflow_logs" ADD CONSTRAINT "workflow_logs_actor_id_user_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_assignments_user" ON "sohoa_app"."dossier_assignments" USING btree ("assignee_id","status","role");--> statement-breakpoint
CREATE UNIQUE INDEX "dossier_files_file_path_unique" ON "sohoa_app"."files" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "idx_dossiers_path" ON "sohoa_app"."dossiers" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "idx_dossiers_status_folder" ON "sohoa_app"."dossiers" USING btree ("status","folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_folder_path_name_unique" ON "sohoa_app"."dossiers" USING btree ("folder_path","name");--> statement-breakpoint
CREATE INDEX "idx_folders_path" ON "sohoa_app"."folders" USING btree ("folder_path");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_folder_path_unique" ON "sohoa_app"."folders" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "group_members_role_idx" ON "sohoa_app"."group_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "group_members_active_idx" ON "sohoa_app"."group_members" USING btree ("group_id","role") WHERE "sohoa_app"."group_members"."expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX "group_members_user_active_idx" ON "sohoa_app"."group_members" USING btree ("user_id","group_id") WHERE "sohoa_app"."group_members"."expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX "groups_name_idx" ON "sohoa_app"."groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "groups_active_idx" ON "sohoa_app"."groups" USING btree ("name") WHERE "sohoa_app"."groups"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_workflow_logs_dossier" ON "sohoa_app"."workflow_logs" USING btree ("dossier_id");