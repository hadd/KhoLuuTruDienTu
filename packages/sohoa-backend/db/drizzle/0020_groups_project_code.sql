ALTER TABLE "sohoa_app"."groups" ADD COLUMN "project_code" varchar(50);--> statement-breakpoint
ALTER TABLE "sohoa_app"."groups" ADD CONSTRAINT "groups_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_groups_project_code" ON "sohoa_app"."groups" USING btree ("project_code");
