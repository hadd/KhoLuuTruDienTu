ALTER TABLE "sohoa_app"."fonds" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."fonds" ADD COLUMN "period" date;--> statement-breakpoint
CREATE INDEX "idx_fonds_is_active" ON "sohoa_app"."fonds" USING btree ("is_active") WHERE "sohoa_app"."fonds"."is_active" = true;