ALTER TABLE "sohoa_app"."projects" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "sohoa_app"."projects" ADD CONSTRAINT "projects_manager_id_user_profiles_id_fk" FOREIGN KEY ("manager_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_projects_manager_id" ON "sohoa_app"."projects" USING btree ("manager_id") WHERE "sohoa_app"."projects"."deleted_at" IS NULL;
