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
ALTER TABLE "sohoa_app"."api_audit_logs" ADD COLUMN "view_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."audit_log_archive_projections" ADD CONSTRAINT "audit_log_archive_projections_shard_id_audit_log_archive_shards_id_fk" FOREIGN KEY ("shard_id") REFERENCES "sohoa_app"."audit_log_archive_shards"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_created_at_desc_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_module_created_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_event_type_created_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_user_created_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_projections_shard_id_idx" ON "sohoa_app"."audit_log_archive_projections" USING btree ("shard_id");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_window_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("window_start","window_end");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_created_range_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("min_created_at","max_created_at");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_status_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_object_key_idx" ON "sohoa_app"."audit_log_archive_shards" USING btree ("object_key");