CREATE TABLE "sohoa_app"."projects" (
	"project_code" varchar(50) PRIMARY KEY NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"project_type" varchar(100),
	"investor" text,
	"start_date" date,
	"acceptance_date" date,
	"total_investment" numeric(18, 2),
	"status" varchar(50) DEFAULT 'IN_PROGRESS' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."project_progress_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_code" varchar(50) NOT NULL,
	"extension_number" integer NOT NULL,
	"previous_acceptance_date" date,
	"new_acceptance_date" date NOT NULL,
	"change_reason" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD COLUMN "project_code" varchar(50);--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "project_code" varchar(50);--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_progress_histories" ADD CONSTRAINT "project_progress_histories_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_progress_histories" ADD CONSTRAINT "project_progress_histories_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD CONSTRAINT "folders_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "sohoa_app"."projects" USING btree ("status") WHERE "sohoa_app"."projects"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_name" ON "sohoa_app"."projects" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "idx_project_progress_histories_project_code" ON "sohoa_app"."project_progress_histories" USING btree ("project_code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_progress_histories_project_ext_unique" ON "sohoa_app"."project_progress_histories" USING btree ("project_code","extension_number");--> statement-breakpoint
CREATE INDEX "idx_folders_project_code" ON "sohoa_app"."folders" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_dossiers_project_code" ON "sohoa_app"."dossiers" USING btree ("project_code");
