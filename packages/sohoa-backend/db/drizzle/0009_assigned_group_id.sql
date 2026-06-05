ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "assigned_group_id" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_assigned_group_id_groups_id_fk" FOREIGN KEY ("assigned_group_id") REFERENCES "sohoa_app"."groups"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_dossiers_assigned_group" ON "sohoa_app"."dossiers" USING btree ("assigned_group_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;
