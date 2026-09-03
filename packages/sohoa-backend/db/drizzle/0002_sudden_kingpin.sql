ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "summary_key" varchar(100);--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "summary_params" jsonb;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_summary_trgm_idx" ON "sohoa_app"."api_audit_logs" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_path_trgm_idx" ON "sohoa_app"."api_audit_logs" USING gin ("path" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_label_trgm_idx" ON "sohoa_app"."api_audit_logs" USING gin ("entity_label" gin_trgm_ops);