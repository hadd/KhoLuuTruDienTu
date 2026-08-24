CREATE TYPE "sohoa_app"."archive_acl_principal_kind" AS ENUM('user', 'role');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_acl_resource_kind" AS ENUM('fond', 'fond_type', 'dossier_type', 'document_type');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_annotation_kind" AS ENUM('BOOKMARK', 'HIGHLIGHT', 'NOTE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_dip_layout" AS ENUM('ZIP', 'UNPACKED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_dip_status" AS ENUM('PENDING', 'READY', 'FAILED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_item_kind" AS ENUM('FILE', 'DOSSIER', 'PHYSICAL_DOSSIER');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_medium" AS ENUM('ELECTRONIC', 'PHYSICAL');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED', 'DELIVERED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_field_type" AS ENUM('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'REFERENCE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_permission_config_status" AS ENUM('draft', 'ready', 'close');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_reference_source" AS ENUM('FOND', 'INVENTORY', 'RETENTION_PERIOD', 'DOSSIER_TYPE', 'PHYSICAL_BOTTOM_ITEM');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_storage_state" AS ENUM('STORING', 'IN_USE', 'TEMPORARILY_LOCKED', 'PENDING_DESTRUCTION', 'DESTROYED', 'TRANSFERRED_TO_HISTORICAL_ARCHIVE');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_submission_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."assignment_status" AS ENUM('IN_PROGRESS', 'DRAFT', 'COMPLETED', 'REJECTED', 'TRANSFERRED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."auth_session_token_type" AS ENUM('access_token', 'refresh_token');--> statement-breakpoint
CREATE TYPE "sohoa_app"."dossier_physical_placement_status" AS ENUM('ACTIVE', 'MOVED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."dossier_status" AS ENUM('NEW', 'OCR_PROCESSING', 'OCR_FAILED', 'READY_FOR_ENTRY', 'ENTRY_PROCESSING', 'WAITING_CHECKER_1', 'CHECKER_1_PROCESSING', 'CHECKER_1_REJECTED', 'WAITING_CHECKER_2', 'CHECKER_2_PROCESSING', 'CHECKER_2_REJECTED', 'WAITING_CHECKER_3', 'CHECKER_3_PROCESSING', 'CHECKER_3_REJECTED', 'WAITING_CHECKER_4', 'CHECKER_4_PROCESSING', 'CHECKER_4_REJECTED', 'WAITING_CHECKER_5', 'CHECKER_5_PROCESSING', 'CHECKER_5_REJECTED', 'WAITING_ISSUE_RESOLUTION', 'ERROR', 'APPROVED', 'PENDING_ARCHIVE', 'ARCHIVE_REJECTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."entity_type" AS ENUM('DOSSIER', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "sohoa_app"."issue_report_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'ESCALATED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."metadata_permission_config_status" AS ENUM('draft', 'ready', 'close');--> statement-breakpoint
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
	"module" varchar(50),
	"event_type" varchar(50),
	"entity_type" varchar(50),
	"entity_id" varchar(100),
	"entity_label" varchar(500),
	"summary" text,
	"source_log_id" uuid,
	"status_code" integer NOT NULL,
	"response_time" integer,
	"ip" varchar(50),
	"user_agent" text,
	"request_body" jsonb,
	"response_body" jsonb,
	"error" text,
	"view_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_acl_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_kind" "sohoa_app"."archive_acl_resource_kind" NOT NULL,
	"resource_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_acl_principals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"principal_kind" "sohoa_app"."archive_acl_principal_kind" NOT NULL,
	"principal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "sohoa_app"."archive_borrow_annotation_kind" NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"bbox" jsonb,
	"selected_text" text,
	"body" text,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_approval_clearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" text NOT NULL,
	"max_security_level_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_dip_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" "sohoa_app"."archive_borrow_dip_status" DEFAULT 'PENDING' NOT NULL,
	"storage_key" text,
	"layout" "sohoa_app"."archive_borrow_dip_layout" DEFAULT 'UNPACKED' NOT NULL,
	"manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checksum" varchar(64),
	"byte_size" integer,
	"has_watermark" boolean DEFAULT false NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"item_kind" "sohoa_app"."archive_borrow_item_kind" NOT NULL,
	"dossier_id" uuid NOT NULL,
	"file_id" uuid,
	"file_ids_snapshot" jsonb,
	"physical_placement_id" uuid,
	"physical_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_reading_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medium" "sohoa_app"."archive_borrow_medium" NOT NULL,
	"requester_id" uuid NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" "sohoa_app"."archive_borrow_status" NOT NULL,
	"requested_from" timestamp with time zone,
	"requested_until" timestamp with time zone,
	"approved_from" timestamp with time zone,
	"approved_until" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"delivered_at" timestamp with time zone,
	"delivered_by" uuid,
	"returned_at" timestamp with time zone,
	"returned_by" uuid,
	"delivery_notes" text,
	"return_notes" text,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "sohoa_app"."archive_group_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"config_id" uuid NOT NULL,
	"fond_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_permission_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "sohoa_app"."archive_permission_config_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_permission_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"slot_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"permission_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fond_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
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
CREATE TABLE "sohoa_app"."archive_user_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"fond_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."audit_log_archive_projections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shard_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"user_id" uuid,
	"user_role" varchar(50),
	"method" varchar(10) NOT NULL,
	"path" varchar(500) NOT NULL,
	"action" varchar(100),
	"module" varchar(50),
	"event_type" varchar(50),
	"entity_type" varchar(50),
	"entity_id" varchar(100),
	"entity_label" varchar(500),
	"summary" text,
	"status_code" integer NOT NULL,
	"view_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."audit_log_archive_shards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"min_created_at" timestamp with time zone NOT NULL,
	"max_created_at" timestamp with time zone NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"uncompressed_bytes" integer DEFAULT 0 NOT NULL,
	"compressed_bytes" integer DEFAULT 0 NOT NULL,
	"checksum" varchar(64),
	"status" varchar(20) DEFAULT 'writing' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."audit_log_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date_from" timestamp with time zone NOT NULL,
	"date_to" timestamp with time zone NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"json_object_key" varchar(500),
	"excel_object_key" varchar(500),
	"purged_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'exported' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."audit_log_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" varchar(50) NOT NULL,
	"action_key" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"label" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."audit_log_purge_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cursor_until" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"lease_owner" varchar(100),
	"lease_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."audit_log_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"max_records" integer,
	"purge_enabled" boolean DEFAULT true NOT NULL,
	"last_purge_at" timestamp with time zone,
	"purge_cursor_until" timestamp with time zone,
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
CREATE TABLE "sohoa_app"."disposal_proposal_catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"catalog_date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" "sohoa_app"."disposal_proposal_catalog_status" DEFAULT 'DRAFT' NOT NULL,
	"appraisal_submitted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."disposal_review_council_item_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"decision" "sohoa_app"."disposal_council_evaluation_decision",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"position_role" varchar(255) NOT NULL,
	"representation_type" "sohoa_app"."disposal_council_member_representation_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"excused_absent" boolean DEFAULT false NOT NULL,
	"absent_reason" text DEFAULT '' NOT NULL,
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
	"decision_published_at" timestamp with time zone,
	"decision_document_storage_key" text,
	"signed_minutes_storage_key" text,
	"both_minutes_exported_at" timestamp with time zone,
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
CREATE TABLE "sohoa_app"."document_naming_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fond_id" text NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"dossier_id" uuid,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_increment_counter" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"retention_period_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"document_type_id" text,
	"security_level_id" uuid,
	"access_password_enabled" boolean DEFAULT false NOT NULL,
	"access_password_hash" varchar(255),
	"password_version" integer DEFAULT 1 NOT NULL,
	"ocr_run_mode" varchar(16) DEFAULT 'auto' NOT NULL,
	"ocr_trigger_status" varchar(16),
	"ocr_triggered_at" timestamp with time zone,
	"ocr_triggered_by" uuid,
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
CREATE TABLE "sohoa_app"."dossier_physical_placements" (
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
CREATE TABLE "sohoa_app"."dossier_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
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
	"archive_storage_state" "sohoa_app"."archive_storage_state" DEFAULT 'STORING' NOT NULL,
	"required_qc_count" integer DEFAULT 0 NOT NULL,
	"current_qc_step" integer DEFAULT 0 NOT NULL,
	"reject_count" integer DEFAULT 0 NOT NULL,
	"last_reject_notes" text,
	"ocr_metadata_key" text,
	"current_metadata_key" text,
	"merge_json_path" text,
	"assigned_group_id" text,
	"fond_id" text,
	"dossier_type_id" text,
	"security_level_id" uuid,
	"access_password_enabled" boolean DEFAULT false NOT NULL,
	"access_password_hash" varchar(255),
	"password_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"export_type" varchar(32) NOT NULL,
	"scope" varchar(32) NOT NULL,
	"resource_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"apply_watermark" boolean DEFAULT false NOT NULL,
	"placement_id" uuid,
	"success" boolean NOT NULL,
	"error_message" text,
	"ip" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."duplicate_detection_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_key" "sohoa_app"."duplicate_detection_rule_key" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"dossier_code_field_key" varchar(128),
	"dossier_summary_field_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."email_sender_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"smtp_host" varchar(255),
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_user" varchar(255),
	"from_email" varchar(255) NOT NULL,
	"from_name" varchar(255),
	"reply_to" varchar(255),
	"smtp_password_encrypted" text NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "sohoa_app"."group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "sohoa_app"."group_member_role" DEFAULT 'editor' NOT NULL,
	"permission_slot_code" text,
	"archive_permission_slot_code" text,
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
	"is_active" boolean DEFAULT true NOT NULL,
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
CREATE TABLE "sohoa_app"."metadata_extract_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" varchar(16) DEFAULT 'old' NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "sohoa_app"."notification_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"role_ids" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_url" text NOT NULL,
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
CREATE TABLE "sohoa_app"."physical_warehouse_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(500) NOT NULL,
	"image_url" text,
	"address" text,
	"maps_url" text,
	"capacity" integer,
	"is_bottom_level" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"duration_value" integer,
	"duration_unit" "sohoa_app"."retention_duration_unit",
	"is_permanent" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" text NOT NULL,
	"hidden_modules" text DEFAULT '[]' NOT NULL,
	"hidden_permissions" text DEFAULT '[]' NOT NULL,
	"is_base_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."security_level_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_level_id" uuid NOT NULL,
	"rule_key" varchar(96) NOT NULL,
	"is_overridden" boolean DEFAULT false NOT NULL,
	"value" jsonb DEFAULT 'false'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."security_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"level_order" integer NOT NULL,
	"password_hash" varchar(255),
	"password_version" integer DEFAULT 1 NOT NULL,
	"file_password_hash" varchar(255),
	"file_password_version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."security_permission_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
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
	"download_password_encrypted" text,
	"download_password_enabled" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "sohoa_app"."watermark_image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"raster_storage_key" text,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."watermark_pdf_security" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"allow_printing" boolean DEFAULT true NOT NULL,
	"allow_changing" boolean DEFAULT false NOT NULL,
	"allow_document_assembly" boolean DEFAULT false NOT NULL,
	"allow_content_copying" boolean DEFAULT false NOT NULL,
	"allow_content_copying_accessibility" boolean DEFAULT true NOT NULL,
	"allow_page_extraction" boolean DEFAULT false NOT NULL,
	"allow_commenting" boolean DEFAULT false NOT NULL,
	"allow_form_filling" boolean DEFAULT true NOT NULL,
	"allow_signing" boolean DEFAULT false NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."watermark_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"image_asset_id" uuid,
	"image_enabled" boolean DEFAULT false NOT NULL,
	"image_opacity" smallint DEFAULT 30 NOT NULL,
	"image_position" varchar(32) DEFAULT 'center' NOT NULL,
	"image_size_percent" smallint DEFAULT 30 NOT NULL,
	"image_offset_x_percent" smallint,
	"image_offset_y_percent" smallint,
	"image_rotation_degrees" smallint DEFAULT 0 NOT NULL,
	"image_stamps" jsonb,
	"text_enabled" boolean DEFAULT false NOT NULL,
	"text_content" text,
	"text_opacity" smallint DEFAULT 30 NOT NULL,
	"text_position" varchar(32) DEFAULT 'center' NOT NULL,
	"text_size_percent" smallint DEFAULT 20 NOT NULL,
	"text_offset_x_percent" smallint,
	"text_offset_y_percent" smallint,
	"text_rotation_degrees" smallint DEFAULT 0 NOT NULL,
	"text_stamps" jsonb,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "sohoa_app"."archive_acl_principals" ADD CONSTRAINT "archive_acl_principals_entry_id_archive_acl_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "sohoa_app"."archive_acl_entries"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_annotations" ADD CONSTRAINT "archive_borrow_annotations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_annotations" ADD CONSTRAINT "archive_borrow_annotations_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_annotations" ADD CONSTRAINT "archive_borrow_annotations_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_approval_clearances" ADD CONSTRAINT "archive_borrow_approval_clearances_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_approval_clearances" ADD CONSTRAINT "archive_borrow_approval_clearances_max_security_level_id_security_levels_id_fk" FOREIGN KEY ("max_security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_dip_packages" ADD CONSTRAINT "archive_borrow_dip_packages_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_physical_placement_id_dossier_physical_placements_id_fk" FOREIGN KEY ("physical_placement_id") REFERENCES "sohoa_app"."dossier_physical_placements"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_physical_item_id_physical_warehouse_items_id_fk" FOREIGN KEY ("physical_item_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_reading_progress" ADD CONSTRAINT "archive_borrow_reading_progress_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_reading_progress" ADD CONSTRAINT "archive_borrow_reading_progress_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_reading_progress" ADD CONSTRAINT "archive_borrow_reading_progress_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_requester_id_user_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_activated_by_user_profiles_id_fk" FOREIGN KEY ("activated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_delivered_by_user_profiles_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_returned_by_user_profiles_id_fk" FOREIGN KEY ("returned_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_group_bindings" ADD CONSTRAINT "archive_group_bindings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "sohoa_app"."groups"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_group_bindings" ADD CONSTRAINT "archive_group_bindings_config_id_archive_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."archive_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_permission_slots" ADD CONSTRAINT "archive_permission_slots_config_id_archive_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."archive_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_submitted_by_user_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_submissions" ADD CONSTRAINT "archive_submissions_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_user_assignments" ADD CONSTRAINT "archive_user_assignments_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_user_assignments" ADD CONSTRAINT "archive_user_assignments_config_id_archive_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."archive_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_user_assignments" ADD CONSTRAINT "archive_user_assignments_assigned_by_user_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."audit_log_archive_projections" ADD CONSTRAINT "audit_log_archive_projections_shard_id_audit_log_archive_shards_id_fk" FOREIGN KEY ("shard_id") REFERENCES "sohoa_app"."audit_log_archive_shards"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_session_tokens" ADD CONSTRAINT "auth_session_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sohoa_app"."auth_sessions"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_session_tokens" ADD CONSTRAINT "auth_session_tokens_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."digital_signatures" ADD CONSTRAINT "digital_signatures_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."digital_signatures" ADD CONSTRAINT "digital_signatures_signed_by_user_profiles_id_fk" FOREIGN KEY ("signed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_catalogs" ADD CONSTRAINT "disposal_proposal_catalogs_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_items" ADD CONSTRAINT "disposal_proposal_items_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_items" ADD CONSTRAINT "disposal_proposal_items_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_proposal_items" ADD CONSTRAINT "disposal_proposal_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD CONSTRAINT "disposal_review_council_item_evaluations_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD CONSTRAINT "disposal_review_council_item_evaluations_item_id_disposal_proposal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "sohoa_app"."disposal_proposal_items"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD CONSTRAINT "disposal_review_council_item_evaluations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_member_history" ADD CONSTRAINT "disposal_review_council_member_history_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_member_history" ADD CONSTRAINT "disposal_review_council_member_history_changed_by_user_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ADD CONSTRAINT "disposal_review_council_members_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ADD CONSTRAINT "disposal_review_council_members_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD CONSTRAINT "disposal_review_councils_catalog_id_disposal_proposal_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "sohoa_app"."disposal_proposal_catalogs"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD CONSTRAINT "disposal_review_councils_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_settings" ADD CONSTRAINT "disposal_settings_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_naming_configs" ADD CONSTRAINT "document_naming_configs_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_naming_configs" ADD CONSTRAINT "document_naming_configs_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_types" ADD CONSTRAINT "document_types_retention_period_id_retention_periods_id_fk" FOREIGN KEY ("retention_period_id") REFERENCES "sohoa_app"."retention_periods"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD CONSTRAINT "dossier_assignments_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD CONSTRAINT "dossier_assignments_assignee_id_user_profiles_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "sohoa_app"."document_types"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_ocr_triggered_by_user_profiles_id_fk" FOREIGN KEY ("ocr_triggered_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_reporter_id_user_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_reporter_assignment_id_dossier_assignments_id_fk" FOREIGN KEY ("reporter_assignment_id") REFERENCES "sohoa_app"."dossier_assignments"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_escalated_to_id_user_profiles_id_fk" FOREIGN KEY ("escalated_to_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_resolved_by_id_user_profiles_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_physical_item_id_physical_warehouse_items_id_fk" FOREIGN KEY ("physical_item_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_location_root_id_physical_warehouse_items_id_fk" FOREIGN KEY ("location_root_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_physical_placements" ADD CONSTRAINT "dossier_physical_placements_archive_submission_id_archive_submissions_id_fk" FOREIGN KEY ("archive_submission_id") REFERENCES "sohoa_app"."archive_submissions"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "sohoa_app"."folders"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_dossier_type_id_dossier_types_id_fk" FOREIGN KEY ("dossier_type_id") REFERENCES "sohoa_app"."dossier_types"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."download_logs" ADD CONSTRAINT "download_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD CONSTRAINT "email_sender_configs_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "sohoa_app"."folders"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD CONSTRAINT "folders_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "sohoa_app"."groups"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD CONSTRAINT "group_members_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."groups" ADD CONSTRAINT "groups_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."inventories" ADD CONSTRAINT "inventories_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_extract_settings" ADD CONSTRAINT "metadata_extract_settings_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_history" ADD CONSTRAINT "metadata_history_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_history" ADD CONSTRAINT "metadata_history_actor_id_user_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_permission_configs" ADD CONSTRAINT "metadata_permission_configs_template_id_metadata_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "sohoa_app"."metadata_templates"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_permission_slots" ADD CONSTRAINT "metadata_permission_slots_config_id_metadata_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."metadata_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD CONSTRAINT "notification_configs_created_by_id_user_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD CONSTRAINT "notification_configs_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" ADD CONSTRAINT "notifications_recipient_id_user_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."paper_plans" ADD CONSTRAINT "paper_plans_plan_id_project_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "sohoa_app"."project_plans"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."paper_plans" ADD CONSTRAINT "paper_plans_paper_size_id_paper_sizes_id_fk" FOREIGN KEY ("paper_size_id") REFERENCES "sohoa_app"."paper_sizes"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."physical_warehouse_items" ADD CONSTRAINT "physical_warehouse_items_parent_id_physical_warehouse_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."plan_details" ADD CONSTRAINT "plan_details_plan_id_project_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "sohoa_app"."project_plans"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" ADD CONSTRAINT "project_plans_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_progress_histories" ADD CONSTRAINT "project_progress_histories_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_progress_histories" ADD CONSTRAINT "project_progress_histories_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."projects" ADD CONSTRAINT "projects_manager_id_user_profiles_id_fk" FOREIGN KEY ("manager_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_level_rules" ADD CONSTRAINT "security_level_rules_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_roles" ADD CONSTRAINT "user_roles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_image_assets" ADD CONSTRAINT "watermark_image_assets_uploaded_by_id_user_profiles_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_pdf_security" ADD CONSTRAINT "watermark_pdf_security_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD CONSTRAINT "watermark_placements_image_asset_id_watermark_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "sohoa_app"."watermark_image_assets"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_placements" ADD CONSTRAINT "watermark_placements_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
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
CREATE INDEX "api_audit_logs_module_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_event_type_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_acl_entries_resource_perm_unique" ON "sohoa_app"."archive_acl_entries" USING btree ("resource_kind","resource_id","permission_key");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_entries_resource" ON "sohoa_app"."archive_acl_entries" USING btree ("resource_kind","resource_id");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_entries_permission" ON "sohoa_app"."archive_acl_entries" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_acl_principals_unique" ON "sohoa_app"."archive_acl_principals" USING btree ("entry_id","principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_principals_principal" ON "sohoa_app"."archive_acl_principals" USING btree ("principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_principals_entry" ON "sohoa_app"."archive_acl_principals" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_annotations_user_request" ON "sohoa_app"."archive_borrow_annotations" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_annotations_request_file" ON "sohoa_app"."archive_borrow_annotations" USING btree ("request_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_annotations_kind" ON "sohoa_app"."archive_borrow_annotations" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_borrow_approval_clearances_role" ON "sohoa_app"."archive_borrow_approval_clearances" USING btree ("role_id") WHERE "sohoa_app"."archive_borrow_approval_clearances"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_approval_clearances_level" ON "sohoa_app"."archive_borrow_approval_clearances" USING btree ("max_security_level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_borrow_dip_packages_request_id" ON "sohoa_app"."archive_borrow_dip_packages" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_dip_packages_status" ON "sohoa_app"."archive_borrow_dip_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_request_id" ON "sohoa_app"."archive_borrow_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_dossier_id" ON "sohoa_app"."archive_borrow_items" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_file_id" ON "sohoa_app"."archive_borrow_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_physical_placement_id" ON "sohoa_app"."archive_borrow_items" USING btree ("physical_placement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_borrow_reading_progress_user_request_file" ON "sohoa_app"."archive_borrow_reading_progress" USING btree ("user_id","request_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_reading_progress_request" ON "sohoa_app"."archive_borrow_reading_progress" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_reading_progress_user_updated" ON "sohoa_app"."archive_borrow_reading_progress" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_medium_status_created" ON "sohoa_app"."archive_borrow_requests" USING btree ("medium","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_requester_created" ON "sohoa_app"."archive_borrow_requests" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_status_approved_until" ON "sohoa_app"."archive_borrow_requests" USING btree ("status","approved_until");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_medium_status" ON "sohoa_app"."archive_borrow_requests" USING btree ("medium","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_field_configs_field_key" ON "sohoa_app"."archive_field_configs" USING btree ("field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_group_bindings_group_unique" ON "sohoa_app"."archive_group_bindings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_archive_group_bindings_config" ON "sohoa_app"."archive_group_bindings" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "archive_permission_configs_active_idx" ON "sohoa_app"."archive_permission_configs" USING btree ("id") WHERE "sohoa_app"."archive_permission_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_permission_slots_config_code_unique" ON "sohoa_app"."archive_permission_slots" USING btree ("config_id","slot_code");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_dossier" ON "sohoa_app"."archive_submissions" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_status" ON "sohoa_app"."archive_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_submissions_submitted_at" ON "sohoa_app"."archive_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_user_assignments_user_config_slot_unique" ON "sohoa_app"."archive_user_assignments" USING btree ("user_id","config_id","slot_code");--> statement-breakpoint
CREATE INDEX "idx_archive_user_assignments_user" ON "sohoa_app"."archive_user_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_created_at_desc_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_module_created_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_event_type_created_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_user_created_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_shard_id_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("shard_id");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_window_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("window_start","window_end");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_created_range_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("min_created_at","max_created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_status_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_object_key_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "audit_log_archives_exported_at_idx" ON "sohoa_app"."audit_log_archives" USING btree ("exported_at");--> statement-breakpoint
CREATE INDEX "audit_log_archives_status_idx" ON "sohoa_app"."audit_log_archives" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_configs_module_action_unique" ON "sohoa_app"."audit_log_configs" USING btree ("module","action_key");--> statement-breakpoint
CREATE INDEX "audit_log_configs_module_idx" ON "sohoa_app"."audit_log_configs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_session_type_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("session_id","type");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_user_expires_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_hash_active_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("token_hash") WHERE "sohoa_app"."auth_session_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "sohoa_app"."auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_idx" ON "sohoa_app"."auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_active_idx" ON "sohoa_app"."auth_sessions" USING btree ("user_id") WHERE "sohoa_app"."auth_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_file" ON "sohoa_app"."digital_signatures" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_digital_signatures_signed_by" ON "sohoa_app"."digital_signatures" USING btree ("signed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_proposal_catalogs_code_unique" ON "sohoa_app"."disposal_proposal_catalogs" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_catalogs_status" ON "sohoa_app"."disposal_proposal_catalogs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_catalogs_created_by" ON "sohoa_app"."disposal_proposal_catalogs" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_proposal_items_catalog_dossier_file_unique" ON "sohoa_app"."disposal_proposal_items" USING btree ("catalog_id","dossier_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_items_catalog_id" ON "sohoa_app"."disposal_proposal_items" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_proposal_items_dossier_id" ON "sohoa_app"."disposal_proposal_items" USING btree ("dossier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_council_item_evaluations_council_item_user_unique" ON "sohoa_app"."disposal_review_council_item_evaluations" USING btree ("council_id","item_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_item_evaluations_council_id" ON "sohoa_app"."disposal_review_council_item_evaluations" USING btree ("council_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_item_evaluations_item_id" ON "sohoa_app"."disposal_review_council_item_evaluations" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_member_history_council_id" ON "sohoa_app"."disposal_review_council_member_history" USING btree ("council_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_member_history_created_at" ON "sohoa_app"."disposal_review_council_member_history" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_review_council_members_council_user_unique" ON "sohoa_app"."disposal_review_council_members" USING btree ("council_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_review_council_members_council_id" ON "sohoa_app"."disposal_review_council_members" USING btree ("council_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_review_councils_code_unique" ON "sohoa_app"."disposal_review_councils" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_review_councils_catalog_id_unique" ON "sohoa_app"."disposal_review_councils" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_review_councils_created_by" ON "sohoa_app"."disposal_review_councils" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_naming_configs_fond_dossier" ON "sohoa_app"."document_naming_configs" USING btree ("fond_id") WHERE "sohoa_app"."document_naming_configs"."target_type" = 'dossier' AND "sohoa_app"."document_naming_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_naming_configs_fond_file" ON "sohoa_app"."document_naming_configs" USING btree ("fond_id","dossier_id") WHERE "sohoa_app"."document_naming_configs"."target_type" = 'file' AND "sohoa_app"."document_naming_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_document_types_name" ON "sohoa_app"."document_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_document_types_retention_period_id" ON "sohoa_app"."document_types" USING btree ("retention_period_id");--> statement-breakpoint
CREATE INDEX "idx_document_types_is_active" ON "sohoa_app"."document_types" USING btree ("is_active") WHERE "sohoa_app"."document_types"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_assignments_user" ON "sohoa_app"."dossier_assignments" USING btree ("assignee_id","status","role");--> statement-breakpoint
CREATE UNIQUE INDEX "dossier_files_file_path_unique" ON "sohoa_app"."files" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "idx_files_dossier_id" ON "sohoa_app"."files" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_files_document_type_id" ON "sohoa_app"."files" USING btree ("document_type_id");--> statement-breakpoint
CREATE INDEX "idx_files_security_level_id" ON "sohoa_app"."files" USING btree ("security_level_id");--> statement-breakpoint
CREATE INDEX "idx_files_ocr_run_mode_trigger_status" ON "sohoa_app"."files" USING btree ("ocr_run_mode","ocr_trigger_status");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_dossier_status" ON "sohoa_app"."dossier_issue_reports" USING btree ("dossier_id","status");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_escalated_to" ON "sohoa_app"."dossier_issue_reports" USING btree ("escalated_to_id","status");--> statement-breakpoint
CREATE INDEX "idx_dossier_physical_placements_dossier_id" ON "sohoa_app"."dossier_physical_placements" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_dossier_physical_placements_physical_item_id" ON "sohoa_app"."dossier_physical_placements" USING btree ("physical_item_id");--> statement-breakpoint
CREATE INDEX "idx_dossier_physical_placements_status" ON "sohoa_app"."dossier_physical_placements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dossier_physical_placements_active_dossier" ON "sohoa_app"."dossier_physical_placements" USING btree ("dossier_id") WHERE "sohoa_app"."dossier_physical_placements"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "idx_dossier_types_name" ON "sohoa_app"."dossier_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_dossier_types_is_active" ON "sohoa_app"."dossier_types" USING btree ("is_active") WHERE "sohoa_app"."dossier_types"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_dossiers_project_code" ON "sohoa_app"."dossiers" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_dossiers_path" ON "sohoa_app"."dossiers" USING btree ("folder_path");--> statement-breakpoint
CREATE INDEX "idx_dossiers_status_folder" ON "sohoa_app"."dossiers" USING btree ("status","folder_id");--> statement-breakpoint
CREATE INDEX "idx_dossiers_assigned_group" ON "sohoa_app"."dossiers" USING btree ("assigned_group_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_dossiers_fond_id" ON "sohoa_app"."dossiers" USING btree ("fond_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_dossiers_dossier_type_id" ON "sohoa_app"."dossiers" USING btree ("dossier_type_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_dossiers_security_level_id" ON "sohoa_app"."dossiers" USING btree ("security_level_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_folder_path_name_unique" ON "sohoa_app"."dossiers" USING btree ("folder_path","name") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "download_logs_user_id_idx" ON "sohoa_app"."download_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "download_logs_created_at_idx" ON "sohoa_app"."download_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "download_logs_user_created_idx" ON "sohoa_app"."download_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_detection_rules_rule_key_unique" ON "sohoa_app"."duplicate_detection_rules" USING btree ("rule_key");--> statement-breakpoint
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
CREATE INDEX "idx_inventories_is_active" ON "sohoa_app"."inventories" USING btree ("is_active") WHERE "sohoa_app"."inventories"."is_active" = true;--> statement-breakpoint
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
CREATE INDEX "notification_configs_type_active_idx" ON "sohoa_app"."notification_configs" USING btree ("notification_type","active");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "sohoa_app"."notifications" USING btree ("recipient_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "sohoa_app"."notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_paper_plans_plan_size" ON "sohoa_app"."paper_plans" USING btree ("plan_id","paper_size_id") WHERE "sohoa_app"."paper_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_paper_plans_active" ON "sohoa_app"."paper_plans" USING btree ("id") WHERE "sohoa_app"."paper_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_paper_sizes" ON "sohoa_app"."paper_sizes" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_paper_sizes_active" ON "sohoa_app"."paper_sizes" USING btree ("id") WHERE "sohoa_app"."paper_sizes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_physical_warehouse_items_parent_id" ON "sohoa_app"."physical_warehouse_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_physical_warehouse_items_name" ON "sohoa_app"."physical_warehouse_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_plan_details_active" ON "sohoa_app"."plan_details" USING btree ("id") WHERE "sohoa_app"."plan_details"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_project_plans_project_code" ON "sohoa_app"."project_plans" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_project_plans_active" ON "sohoa_app"."project_plans" USING btree ("id") WHERE "sohoa_app"."project_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_project_progress_histories_project_code" ON "sohoa_app"."project_progress_histories" USING btree ("project_code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_progress_histories_project_ext_unique" ON "sohoa_app"."project_progress_histories" USING btree ("project_code","extension_number");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "sohoa_app"."projects" USING btree ("status") WHERE "sohoa_app"."projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_name" ON "sohoa_app"."projects" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "idx_projects_manager_id" ON "sohoa_app"."projects" USING btree ("manager_id") WHERE "sohoa_app"."projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_retention_periods_is_active" ON "sohoa_app"."retention_periods" USING btree ("is_active") WHERE "sohoa_app"."retention_periods"."is_active" = true;--> statement-breakpoint
CREATE INDEX "roles_name_idx" ON "sohoa_app"."roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "roles_is_base_role_idx" ON "sohoa_app"."roles" USING btree ("is_base_role");--> statement-breakpoint
CREATE INDEX "roles_active_idx" ON "sohoa_app"."roles" USING btree ("name","is_base_role") WHERE "sohoa_app"."roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "security_level_rules_level_rule_unique" ON "sohoa_app"."security_level_rules" USING btree ("security_level_id","rule_key");--> statement-breakpoint
CREATE INDEX "idx_security_level_rules_level_id" ON "sohoa_app"."security_level_rules" USING btree ("security_level_id");--> statement-breakpoint
CREATE INDEX "idx_security_level_rules_rule_key" ON "sohoa_app"."security_level_rules" USING btree ("rule_key");--> statement-breakpoint
CREATE UNIQUE INDEX "security_levels_name_lower_unique" ON "sohoa_app"."security_levels" USING btree (lower("name")) WHERE "sohoa_app"."security_levels"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "security_levels_level_order_unique" ON "sohoa_app"."security_levels" USING btree ("level_order") WHERE "sohoa_app"."security_levels"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_security_levels_is_active" ON "sohoa_app"."security_levels" USING btree ("is_active") WHERE "sohoa_app"."security_levels"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "security_permission_defs_key_unique" ON "sohoa_app"."security_permission_defs" USING btree ("key") WHERE "sohoa_app"."security_permission_defs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_security_permission_defs_is_active" ON "sohoa_app"."security_permission_defs" USING btree ("is_active") WHERE "sohoa_app"."security_permission_defs"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_active_idx" ON "sohoa_app"."user_profiles" USING btree ("email") WHERE "sohoa_app"."user_profiles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_profiles_active_idx" ON "sohoa_app"."user_profiles" USING btree ("email","full_name") WHERE "sohoa_app"."user_profiles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "sohoa_app"."user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "sohoa_app"."user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_expired_at_idx" ON "sohoa_app"."user_roles" USING btree ("expired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_active_unique" ON "sohoa_app"."user_roles" USING btree ("user_id","role_id") WHERE "sohoa_app"."user_roles"."expired_at" IS NULL;--> statement-breakpoint
CREATE INDEX "watermark_image_assets_status_idx" ON "sohoa_app"."watermark_image_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "watermark_image_assets_created_at_idx" ON "sohoa_app"."watermark_image_assets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "watermark_pdf_security_key_unique" ON "sohoa_app"."watermark_pdf_security" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "watermark_placements_single_active_idx" ON "sohoa_app"."watermark_placements" USING btree ("is_active") WHERE "sohoa_app"."watermark_placements"."is_active" = true;--> statement-breakpoint
CREATE INDEX "watermark_placements_image_asset_id_idx" ON "sohoa_app"."watermark_placements" USING btree ("image_asset_id");--> statement-breakpoint
CREATE INDEX "watermark_placements_created_at_idx" ON "sohoa_app"."watermark_placements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_logs_dossier" ON "sohoa_app"."workflow_logs" USING btree ("dossier_id");