ALTER TABLE "sohoa_app"."disposal_proposal_catalogs" ADD COLUMN IF NOT EXISTS "appraisal_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD COLUMN IF NOT EXISTS "both_minutes_exported_at" timestamp with time zone;
