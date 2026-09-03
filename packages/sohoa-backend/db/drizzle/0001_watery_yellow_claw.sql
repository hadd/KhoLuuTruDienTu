ALTER TABLE "sohoa_app"."audit_log_archive_shards" ADD COLUMN "record_ids" text[];--> statement-breakpoint
UPDATE "sohoa_app"."audit_log_archive_shards" s
SET "record_ids" = ARRAY(
    SELECT p.id::text
    FROM "sohoa_app"."audit_log_archive_projections" p
    WHERE p.shard_id = s.id
)
WHERE s.record_ids IS NULL
  AND s.status = 'ready';--> statement-breakpoint
UPDATE "sohoa_app"."audit_log_archive_shards"
SET "record_ids" = '{}'::text[]
WHERE "record_ids" IS NULL;--> statement-breakpoint
CREATE INDEX "audit_log_archive_shards_record_ids_gin_idx" ON "sohoa_app"."audit_log_archive_shards" USING gin ("record_ids");