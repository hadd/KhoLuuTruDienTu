ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "entity_label" varchar(500);--> statement-breakpoint
ALTER TABLE "sohoa_app"."audit_log_settings" ADD COLUMN "max_records" integer;
