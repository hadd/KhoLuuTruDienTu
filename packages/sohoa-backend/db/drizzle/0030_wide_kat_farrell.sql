CREATE TABLE "sohoa_app"."paper_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"paper_size_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "uk_paper_plans_plan_size" UNIQUE("plan_id","paper_size_id")
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."paper_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."plan_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" varchar(50) NOT NULL,
	"quota" integer DEFAULT 0 NOT NULL,
	"date_count" integer DEFAULT 0 NOT NULL,
	"worker_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" ADD COLUMN "date_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."paper_plans" ADD CONSTRAINT "paper_plans_plan_id_project_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "sohoa_app"."project_plans"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."paper_plans" ADD CONSTRAINT "paper_plans_paper_size_id_paper_sizes_id_fk" FOREIGN KEY ("paper_size_id") REFERENCES "sohoa_app"."paper_sizes"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."plan_details" ADD CONSTRAINT "plan_details_plan_id_project_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "sohoa_app"."project_plans"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_paper_plans_plan_size" ON "sohoa_app"."paper_plans" USING btree ("plan_id","paper_size_id") WHERE "sohoa_app"."paper_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_paper_plans_active" ON "sohoa_app"."paper_plans" USING btree ("id") WHERE "sohoa_app"."paper_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_paper_sizes" ON "sohoa_app"."paper_sizes" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_paper_sizes_active" ON "sohoa_app"."paper_sizes" USING btree ("id") WHERE "sohoa_app"."paper_sizes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_plan_details_active" ON "sohoa_app"."plan_details" USING btree ("id") WHERE "sohoa_app"."plan_details"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" DROP COLUMN "a4_pages";--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" DROP COLUMN "a3_pages";--> statement-breakpoint
ALTER TABLE "sohoa_app"."project_plans" DROP COLUMN "quota";