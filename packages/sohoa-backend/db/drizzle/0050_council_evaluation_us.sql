DO $$ BEGIN
  CREATE TYPE "sohoa_app"."disposal_council_evaluation_decision" AS ENUM('DESTROY', 'KEEP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD COLUMN IF NOT EXISTS "decision" "sohoa_app"."disposal_council_evaluation_decision";
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ADD COLUMN IF NOT EXISTS "excused_absent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ADD COLUMN IF NOT EXISTS "absent_reason" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD COLUMN IF NOT EXISTS "decision_published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD COLUMN IF NOT EXISTS "decision_document_storage_key" text;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_councils" ADD COLUMN IF NOT EXISTS "signed_minutes_storage_key" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."disposal_review_council_item_evaluation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"old_decision" "sohoa_app"."disposal_council_evaluation_decision",
	"new_decision" "sohoa_app"."disposal_council_evaluation_decision" NOT NULL,
	"old_note" text,
	"new_note" text NOT NULL,
	"change_reason" text,
	"changed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sohoa_app"."disposal_review_council_item_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"destroy_vote_count" integer DEFAULT 0 NOT NULL,
	"keep_vote_count" integer DEFAULT 0 NOT NULL,
	"participating_member_count" integer DEFAULT 0 NOT NULL,
	"concluded_decision" "sohoa_app"."disposal_council_evaluation_decision",
	"has_dissent" boolean DEFAULT false NOT NULL,
	"needs_chair_decision" boolean DEFAULT false NOT NULL,
	"chair_decision" "sohoa_app"."disposal_council_evaluation_decision",
	"chair_reason" text,
	"chair_decided_by" uuid,
	"chair_decided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_item_id_disposal_proposal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "sohoa_app"."disposal_proposal_items"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluation_history" ADD CONSTRAINT "disposal_review_council_item_evaluation_history_changed_by_user_profiles_id_fk" FOREIGN KEY ("changed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_outcomes" ADD CONSTRAINT "disposal_review_council_item_outcomes_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_outcomes" ADD CONSTRAINT "disposal_review_council_item_outcomes_item_id_disposal_proposal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "sohoa_app"."disposal_proposal_items"("id") ON DELETE cascade ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sohoa_app"."disposal_review_council_item_outcomes" ADD CONSTRAINT "disposal_review_council_item_outcomes_chair_decided_by_user_profiles_id_fk" FOREIGN KEY ("chair_decided_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disposal_council_eval_history_council_id" ON "sohoa_app"."disposal_review_council_item_evaluation_history" ("council_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disposal_council_eval_history_item_id" ON "sohoa_app"."disposal_review_council_item_evaluation_history" ("item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "disposal_council_item_outcomes_council_item_unique" ON "sohoa_app"."disposal_review_council_item_outcomes" ("council_id","item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disposal_council_item_outcomes_council_id" ON "sohoa_app"."disposal_review_council_item_outcomes" ("council_id");
