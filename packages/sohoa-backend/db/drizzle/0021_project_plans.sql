CREATE TABLE "sohoa_app"."project_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"project_code" varchar(50) NOT NULL,
	"a4_pages" integer DEFAULT 0 NOT NULL,
	"a3_pages" integer DEFAULT 0 NOT NULL,
	"dossier_count" integer DEFAULT 0 NOT NULL,
	"quota" numeric(18, 2),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" ADD CONSTRAINT "project_plans_project_code_projects_project_code_fk" FOREIGN KEY ("project_code") REFERENCES "sohoa_app"."projects"("project_code") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_project_plans_project_code" ON "sohoa_app"."project_plans" USING btree ("project_code");--> statement-breakpoint
CREATE INDEX "idx_project_plans_active" ON "sohoa_app"."project_plans" USING btree ("id") WHERE "sohoa_app"."project_plans"."deleted_at" IS NULL;
