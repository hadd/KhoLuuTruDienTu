ALTER TABLE "sohoa_app"."dossier_types" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."inventories" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."retention_periods" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_dossier_types_is_active" ON "sohoa_app"."dossier_types" USING btree ("is_active") WHERE "sohoa_app"."dossier_types"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_inventories_is_active" ON "sohoa_app"."inventories" USING btree ("is_active") WHERE "sohoa_app"."inventories"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_retention_periods_is_active" ON "sohoa_app"."retention_periods" USING btree ("is_active") WHERE "sohoa_app"."retention_periods"."is_active" = true;