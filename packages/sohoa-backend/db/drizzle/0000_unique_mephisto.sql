CREATE TYPE "sohoa_app"."archive_field_type" AS ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'REFERENCE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_reference_source" AS ENUM('FOND', 'INVENTORY', 'RETENTION_PERIOD', 'DOSSIER_TYPE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_submission_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."assignment_status" AS ENUM('IN_PROGRESS', 'DRAFT', 'COMPLETED', 'REJECTED', 'TRANSFERRED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."auth_session_token_type" AS ENUM('access_token', 'refresh_token');--> statement-breakpoint
CREATE TYPE "sohoa_app"."dossier_status" AS ENUM('NEW', 'OCR_PROCESSING', 'OCR_FAILED', 'READY_FOR_ENTRY', 'ENTRY_PROCESSING', 'WAITING_CHECKER_1', 'CHECKER_1_PROCESSING', 'CHECKER_1_REJECTED', 'WAITING_CHECKER_2', 'CHECKER_2_PROCESSING', 'CHECKER_2_REJECTED', 'WAITING_CHECKER_3', 'CHECKER_3_PROCESSING', 'CHECKER_3_REJECTED', 'WAITING_CHECKER_4', 'CHECKER_4_PROCESSING', 'CHECKER_4_REJECTED', 'WAITING_CHECKER_5', 'CHECKER_5_PROCESSING', 'CHECKER_5_REJECTED', 'WAITING_ISSUE_RESOLUTION', 'APPROVED', 'PENDING_ARCHIVE', 'ARCHIVE_REJECTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."entity_type" AS ENUM('DOSSIER', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "sohoa_app"."issue_report_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'ESCALATED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."metadata_permission_config_status" AS ENUM('draft', 'ready', 'close');--> statement-breakpoint
CREATE TYPE "sohoa_app"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "sohoa_app"."work_quality" AS ENUM('CORRECT', 'INCORRECT');--> statement-breakpoint
CREATE TYPE "sohoa_app"."worker_role" AS ENUM('MAKER', 'CHECKER_1', 'CHECKER_2', 'CHECKER_3', 'CHECKER_4', 'CHECKER_5');--> statement-breakpoint
CREATE TABLE "sohoa_app"."api_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(50),
	"user_id" uuid,
	"user_role" varchar(50),
	"method" varchar(10) NOT NULL,
	"path" varchar(500) NOT NULL,
	"query" jsonb,
	"action" varchar(100),
	"status_code" integer NOT NULL,
	"response_time" integer,
	"ip" varchar(50),
	"user_agent" text,
	"request_body" jsonb,
	"response_body" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "sohoa_app"."auth_session_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "sohoa_app"."auth_session_token_type" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."digital_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"signed_by" uuid,
	"certificate_subject" text NOT NULL,
	"certificate_thumbprint" varchar(128) NOT NULL,
	"certificate_issuer" text NOT NULL,
	"certificate_valid_from" timestamp with time zone,
	"certificate_valid_to" timestamp with time zone,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossier_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"role" "sohoa_app"."worker_role" NOT NULL,
	"assignee_id" uuid NOT NULL,
	"metadata_key" text,
	"allowed_fields" text,
	"reject_fields" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"step_number" integer DEFAULT 1 NOT NULL,
	"status" "sohoa_app"."assignment_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"work_quality" "sohoa_app"."work_quality",
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
	"signed_file_path" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossier_issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reporter_assignment_id" uuid NOT NULL,
	"target_role" "sohoa_app"."worker_role" NOT NULL,
	"status" "sohoa_app"."issue_report_status" DEFAULT 'PENDING' NOT NULL,
	"type" varchar(100) NOT NULL,
	"notes" text NOT NULL,
	"resolve_notes" text,
	"escalated_to_id" uuid,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossier_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"folder_path" varchar(500) NOT NULL,
	"project_code" varchar(50),
	"name" varchar(255) NOT NULL,
	"type" "sohoa_app"."entity_type" NOT NULL,
	"status" "sohoa_app"."dossier_status" DEFAULT 'NEW' NOT NULL,
	"required_qc_count" integer DEFAULT 0 NOT NULL,
	"current_qc_step" integer DEFAULT 0 NOT NULL,
	"reject_count" integer DEFAULT 0 NOT NULL,
	"last_reject_notes" text,
	"ocr_metadata_key" text,
	"current_metadata_key" text,
	"assigned_group_id" text,
	"fond_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"project_code" varchar(50),
	"folder_path" varchar(500) NOT NULL,
	"folder_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."fonds" (
	"id" text PRIMARY KEY NOT NULL,
	"fond_name" varchar(255) NOT NULL,
	"archive_agency" varchar(255) NOT NULL,
	"adminstrative_history" text NOT NULL,
	"fond_type" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TYPE "sohoa_app"."group_member_role" AS ENUM('leader', 'editor', 'qc1', 'qc2', 'qc3', 'qc4', 'qc5');--> statement-breakpoint
CREATE TABLE "sohoa_app"."group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "sohoa_app"."group_member_role" DEFAULT 'editor' NOT NULL,
	"permission_slot_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_code" varchar(50),
	"round_number" integer DEFAULT 3 NOT NULL,
	"dossiers_per_editor" integer,
	"metadata_permission_config_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."inventories" (
	"id" text PRIMARY KEY NOT NULL,
	"number" varchar(100) NOT NULL,
	"name" varchar(500) NOT NULL,
	"fond_id" text NOT NULL,
	"submission_year" integer NOT NULL,
	"submitting_unit" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "sohoa_app"."metadata_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"actor_id" uuid,
	"role" "sohoa_app"."worker_role",
	"action" varchar(50) NOT NULL,
	"from_status" "sohoa_app"."dossier_status",
	"to_status" "sohoa_app"."dossier_status",
	"s3_key" text NOT NULL,
	"field_changes" jsonb,
	"version_number" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_permission_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template_id" uuid NOT NULL,
	"status" "sohoa_app"."metadata_permission_config_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_permission_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"slot_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"field_keys" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_dossier_id" uuid NOT NULL,
	"source_ocr_metadata_key" text NOT NULL,
	"field_catalog" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_config_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_config_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" varchar(50) NOT NULL,
	"status" "sohoa_app"."notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"action_url" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."paper_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"paper_size_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uk_paper_plans_plan_size" UNIQUE("plan_id","paper_size_id")
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."paper_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."plan_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" varchar(50) NOT NULL,
	"quota" integer DEFAULT 0 NOT NULL,
	"date_count" integer DEFAULT 0 NOT NULL,
	"worker_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."project_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"project_code" varchar(50) NOT NULL,
	"dossier_count" integer DEFAULT 0 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"date_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."project_progress_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(50) NOT NULL,
	"extension_number" integer NOT NULL,
	"previous_acceptance_date" date,
	"new_acceptance_date" date NOT NULL,
	"change_reason" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."projects" (
	"project_code" varchar(50) PRIMARY KEY NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"project_type" varchar(100),
	"investor" text,
	"start_date" date,
	"acceptance_date" date,
	"total_investment" numeric(18, 2),
	"status" varchar(50) DEFAULT 'IN_PROGRESS' NOT NULL,
	"manager_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."retention_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" text NOT NULL,
	"is_base_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"avatar_url" text,
	"date_of_birth" date,
	"gender" varchar(50),
	"phone" varchar(50),
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp with time zone
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
ALTER TABLE "sohoa_app"."api_audit_logs" ADD CONSTRAINT "api_audit_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_submitted_by_user_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_session_tokens" ADD CONSTRAINT "auth_session_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sohoa_app"."auth_sessions"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_session_tokens" ADD CONSTRAINT "auth_session_tokens_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."digital_signatures" ADD CONSTRAINT "digital_signatures_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."digital_signatures" ADD CONSTRAINT "digital_signatures_signed_by_user_profiles_id_fk" FOREIGN KEY ("signed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD CONSTRAINT "dossier_assignments_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD CONSTRAINT "dossier_assignments_assignee_id_user_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_reporter_id_user_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_reporter_assignment_id_dossier_assignments_id_fk" FOREIGN KEY ("reporter_assignment_id") REFERENCES "sohoa_app"."dossier_assignments"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_escalated_to_id_user_profiles_id_fk" FOREIGN KEY ("escalated_to_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_resolved_by_id_user_profiles_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "sohoa_app"."folders"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "sohoa_app"."folders"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD CONSTRAINT "folders_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "sohoa_app"."groups"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD CONSTRAINT "group_members_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."groups" ADD CONSTRAINT "groups_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."inventories" ADD CONSTRAINT "inventories_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_history" ADD CONSTRAINT "metadata_history_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_history" ADD CONSTRAINT "metadata_history_actor_id_user_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_permission_configs" ADD CONSTRAINT "metadata_permission_configs_template_id_metadata_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "sohoa_app"."metadata_templates"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_permission_slots" ADD CONSTRAINT "metadata_permission_slots_config_id_metadata_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."metadata_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_config_channels" ADD CONSTRAINT "notification_config_channels_config_id_notification_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."notification_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_config_roles" ADD CONSTRAINT "notification_config_roles_config_id_notification_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."notification_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_config_roles" ADD CONSTRAINT "notification_config_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD CONSTRAINT "notification_configs_created_by_id_user_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD CONSTRAINT "notification_configs_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "sohoa_app"."notifications"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" ADD CONSTRAINT "notifications_recipient_id_user_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."paper_plans" ADD CONSTRAINT "paper_plans_plan_id_project_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "sohoa_app"."project_plans"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."paper_plans" ADD CONSTRAINT "paper_plans_paper_size_id_paper_sizes_id_fk" FOREIGN KEY ("paper_size_id") REFERENCES "sohoa_app"."paper_sizes"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."plan_details" ADD CONSTRAINT "plan_details_plan_id_project_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "sohoa_app"."project_plans"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" ADD CONSTRAINT "project_plans_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_progress_histories" ADD CONSTRAINT "project_progress_histories_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_progress_histories" ADD CONSTRAINT "project_progress_histories_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."projects" ADD CONSTRAINT "projects_manager_id_user_profiles_id_fk" FOREIGN KEY ("manager_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_roles" ADD CONSTRAINT "user_roles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."workflow_logs" ADD CONSTRAINT "workflow_logs_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."workflow_logs" ADD CONSTRAINT "workflow_logs_actor_id_user_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "api_audit_logs_request_id_idx" ON "sohoa_app"."api_audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "api_audit_logs_user_id_idx" ON "sohoa_app"."api_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_audit_logs_action_idx" ON "sohoa_app"."api_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "api_audit_logs_status_code_idx" ON "sohoa_app"."api_audit_logs" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "api_audit_logs_created_at_idx" ON "sohoa_app"."api_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_user_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_user_action_idx" ON "sohoa_app"."api_audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "api_audit_logs_status_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("status_code","created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_created_at_desc_idx" ON "sohoa_app"."api_audit_logs" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "api_audit_logs_errors_idx" ON "sohoa_app"."api_audit_logs" USING btree ("status_code","created_at") WHERE "sohoa_app"."api_audit_logs"."status_code" >= 400;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_field_configs_field_key" ON "sohoa_app"."archive_field_configs" USING btree ("field_key");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_dossier" ON "sohoa_app"."archive_submissions" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_status" ON "sohoa_app"."archive_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_submitted_at" ON "sohoa_app"."archive_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_session_type_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("session_id","type");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_user_expires_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_hash_active_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("token_hash") WHERE "sohoa_app"."auth_session_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "sohoa_app"."auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_idx" ON "sohoa_app"."auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_active_idx" ON "sohoa_app"."auth_sessions" USING btree ("user_id") WHERE "sohoa_app"."auth_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_file" ON "sohoa_app"."digital_signatures" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_signed_by" ON "sohoa_app"."digital_signatures" USING btree ("signed_by");--> statement-breakpoint
CREATE INDEX "idx_assignments_user" ON "sohoa_app"."dossier_assignments" USING btree ("assignee_id","status","role");--> statement-breakpoint
CREATE UNIQUE INDEX "dossier_files_file_path_unique" ON "sohoa_app"."files" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_dossier_status" ON "sohoa_app"."dossier_issue_reports" USING btree ("dossier_id","status");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_escalated_to" ON "sohoa_app"."dossier_issue_reports" USING btree ("escalated_to_id","status");--> statement-breakpoint
CREATE INDEX "idx_dossier_types_name" ON "sohoa_app"."dossier_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_dossiers_project_code" ON "sohoa_app"."dossiers" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_dossiers_path" ON "sohoa_app"."dossiers" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "idx_dossiers_status_folder" ON "sohoa_app"."dossiers" USING btree ("status","folder_id");--> statement-breakpoint
CREATE INDEX "idx_dossiers_assigned_group" ON "sohoa_app"."dossiers" USING btree ("assigned_group_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_dossiers_fond_id" ON "sohoa_app"."dossiers" USING btree ("fond_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_folder_path_name_unique" ON "sohoa_app"."dossiers" USING btree ("folder_path","name") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_folders_project_code" ON "sohoa_app"."folders" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_folders_path" ON "sohoa_app"."folders" USING btree ("folder_path");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_folder_path_unique" ON "sohoa_app"."folders" USING btree ("folder_path") WHERE "sohoa_app"."folders"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fonds_name" ON "sohoa_app"."fonds" USING btree ("fond_name");--> statement-breakpoint
CREATE INDEX "idx_fonds_type" ON "sohoa_app"."fonds" USING btree ("fond_type");--> statement-breakpoint
CREATE INDEX "idx_fonds_archive_agency" ON "sohoa_app"."fonds" USING btree ("archive_agency") WHERE "sohoa_app"."fonds"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fonds_is_active" ON "sohoa_app"."fonds" USING btree ("is_active") WHERE "sohoa_app"."fonds"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_active_editor_unique" ON "sohoa_app"."group_members" USING btree ("group_id","user_id") WHERE "sohoa_app"."group_members"."expired_at" IS NULL AND "sohoa_app"."group_members"."role" = 'editor';--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_active_editor_user_unique" ON "sohoa_app"."group_members" USING btree ("user_id") WHERE "sohoa_app"."group_members"."expired_at" IS NULL AND "sohoa_app"."group_members"."role" = 'editor';--> statement-breakpoint
CREATE INDEX "group_members_group_active_idx" ON "sohoa_app"."group_members" USING btree ("group_id") WHERE "sohoa_app"."group_members"."expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX "groups_name_idx" ON "sohoa_app"."groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_groups_project_code" ON "sohoa_app"."groups" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_inventories_name" ON "sohoa_app"."inventories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_inventories_number" ON "sohoa_app"."inventories" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_inventories_fond_id" ON "sohoa_app"."inventories" USING btree ("fond_id");--> statement-breakpoint
CREATE INDEX "idx_inventories_submission_year" ON "sohoa_app"."inventories" USING btree ("submission_year");--> statement-breakpoint
CREATE INDEX "metadata_export_presets_name_idx" ON "sohoa_app"."metadata_export_presets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "metadata_export_presets_active_idx" ON "sohoa_app"."metadata_export_presets" USING btree ("id") WHERE "sohoa_app"."metadata_export_presets"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_metadata_history_dossier" ON "sohoa_app"."metadata_history" USING btree ("dossier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metadata_history_dossier_version_unique" ON "sohoa_app"."metadata_history" USING btree ("dossier_id","version_number");--> statement-breakpoint
CREATE INDEX "metadata_permission_configs_template_idx" ON "sohoa_app"."metadata_permission_configs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "metadata_permission_configs_active_idx" ON "sohoa_app"."metadata_permission_configs" USING btree ("id") WHERE "sohoa_app"."metadata_permission_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "metadata_permission_slots_config_code_unique" ON "sohoa_app"."metadata_permission_slots" USING btree ("config_id","slot_code");--> statement-breakpoint
CREATE INDEX "metadata_templates_name_idx" ON "sohoa_app"."metadata_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "metadata_templates_active_idx" ON "sohoa_app"."metadata_templates" USING btree ("id") WHERE "sohoa_app"."metadata_templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "metadata_templates_is_active_idx" ON "sohoa_app"."metadata_templates" USING btree ("is_active") WHERE "sohoa_app"."metadata_templates"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_config_channels_unique" ON "sohoa_app"."notification_config_channels" USING btree ("config_id","channel");--> statement-breakpoint
CREATE INDEX "notification_config_channels_channel_idx" ON "sohoa_app"."notification_config_channels" USING btree ("channel");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_config_roles_unique" ON "sohoa_app"."notification_config_roles" USING btree ("config_id","role_id");--> statement-breakpoint
CREATE INDEX "notification_config_roles_role_idx" ON "sohoa_app"."notification_config_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "notification_configs_type_active_idx" ON "sohoa_app"."notification_configs" USING btree ("notification_type","active") WHERE "sohoa_app"."notification_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_configs_dedupe_active_unique" ON "sohoa_app"."notification_configs" USING btree ("dedupe_key") WHERE "sohoa_app"."notification_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notification_deliveries_channel_status_idx" ON "sohoa_app"."notification_deliveries" USING btree ("channel","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "sohoa_app"."notifications" USING btree ("recipient_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "sohoa_app"."notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_paper_plans_plan_size" ON "sohoa_app"."paper_plans" USING btree ("plan_id","paper_size_id") WHERE "sohoa_app"."paper_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_paper_plans_active" ON "sohoa_app"."paper_plans" USING btree ("id") WHERE "sohoa_app"."paper_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_paper_sizes" ON "sohoa_app"."paper_sizes" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_paper_sizes_active" ON "sohoa_app"."paper_sizes" USING btree ("id") WHERE "sohoa_app"."paper_sizes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_plan_details_active" ON "sohoa_app"."plan_details" USING btree ("id") WHERE "sohoa_app"."plan_details"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_project_plans_project_code" ON "sohoa_app"."project_plans" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_project_plans_active" ON "sohoa_app"."project_plans" USING btree ("id") WHERE "sohoa_app"."project_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_project_progress_histories_project_code" ON "sohoa_app"."project_progress_histories" USING btree ("project_code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_progress_histories_project_ext_unique" ON "sohoa_app"."project_progress_histories" USING btree ("project_code","extension_number");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "sohoa_app"."projects" USING btree ("status") WHERE "sohoa_app"."projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_name" ON "sohoa_app"."projects" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "idx_projects_manager_id" ON "sohoa_app"."projects" USING btree ("manager_id") WHERE "sohoa_app"."projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_retention_periods_name" ON "sohoa_app"."retention_periods" USING btree ("name");--> statement-breakpoint
CREATE INDEX "roles_name_idx" ON "sohoa_app"."roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "roles_is_base_role_idx" ON "sohoa_app"."roles" USING btree ("is_base_role");--> statement-breakpoint
CREATE INDEX "roles_active_idx" ON "sohoa_app"."roles" USING btree ("name","is_base_role") WHERE "sohoa_app"."roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_active_idx" ON "sohoa_app"."user_profiles" USING btree ("email") WHERE "sohoa_app"."user_profiles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_profiles_active_idx" ON "sohoa_app"."user_profiles" USING btree ("email","full_name") WHERE "sohoa_app"."user_profiles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "sohoa_app"."user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "sohoa_app"."user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_expired_at_idx" ON "sohoa_app"."user_roles" USING btree ("expired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_active_unique" ON "sohoa_app"."user_roles" USING btree ("user_id","role_id") WHERE "sohoa_app"."user_roles"."expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_workflow_logs_dossier" ON "sohoa_app"."workflow_logs" USING btree ("dossier_id");