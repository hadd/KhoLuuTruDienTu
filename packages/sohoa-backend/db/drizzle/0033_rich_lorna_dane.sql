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
CREATE TABLE "sohoa_app"."audit_log_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"purge_enabled" boolean DEFAULT true NOT NULL,
	"last_purge_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "module" varchar(50);--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "event_type" varchar(50);--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "entity_type" varchar(50);--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "entity_id" varchar(100);--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "source_log_id" uuid;--> statement-breakpoint
CREATE INDEX "audit_log_archives_exported_at_idx" ON "sohoa_app"."audit_log_archives" USING btree ("exported_at");--> statement-breakpoint
CREATE INDEX "audit_log_archives_status_idx" ON "sohoa_app"."audit_log_archives" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_log_configs_module_action_unique" ON "sohoa_app"."audit_log_configs" USING btree ("module","action_key");--> statement-breakpoint
CREATE INDEX "audit_log_configs_module_idx" ON "sohoa_app"."audit_log_configs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "api_audit_logs_module_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_event_type_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("event_type","created_at");