CREATE TABLE "sohoa_app"."disposal_review_council_item_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"council_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_members" ALTER COLUMN "position_role" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD CONSTRAINT "disposal_review_council_item_evaluations_council_id_disposal_review_councils_id_fk" FOREIGN KEY ("council_id") REFERENCES "sohoa_app"."disposal_review_councils"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD CONSTRAINT "disposal_review_council_item_evaluations_item_id_disposal_proposal_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "sohoa_app"."disposal_proposal_items"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."disposal_review_council_item_evaluations" ADD CONSTRAINT "disposal_review_council_item_evaluations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_council_item_evaluations_council_item_user_unique" ON "sohoa_app"."disposal_review_council_item_evaluations" USING btree ("council_id","item_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_item_evaluations_council_id" ON "sohoa_app"."disposal_review_council_item_evaluations" USING btree ("council_id");--> statement-breakpoint
CREATE INDEX "idx_disposal_council_item_evaluations_item_id" ON "sohoa_app"."disposal_review_council_item_evaluations" USING btree ("item_id");--> statement-breakpoint
INSERT INTO "sohoa_app"."notification_configs" (
	"notification_type",
	"channels",
	"role_ids",
	"active"
)
SELECT
	'DISPOSAL_COUNCIL_ASSIGNED',
	ARRAY['system']::text[],
	ARRAY['admin']::text[],
	true
WHERE NOT EXISTS (
	SELECT 1
	FROM "sohoa_app"."notification_configs"
	WHERE "notification_type" = 'DISPOSAL_COUNCIL_ASSIGNED'
		AND "active" = true
);