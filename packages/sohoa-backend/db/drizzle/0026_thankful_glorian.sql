CREATE TABLE "sohoa_app"."security_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"level_order" integer NOT NULL,
	"require_encryption" boolean DEFAULT false NOT NULL,
	"require_watermark" boolean DEFAULT false NOT NULL,
	"export_role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "security_levels_name_lower_unique" ON "sohoa_app"."security_levels" USING btree (lower("name")) WHERE "sohoa_app"."security_levels"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "security_levels_level_order_unique" ON "sohoa_app"."security_levels" USING btree ("level_order") WHERE "sohoa_app"."security_levels"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_security_levels_is_active" ON "sohoa_app"."security_levels" USING btree ("is_active") WHERE "sohoa_app"."security_levels"."is_active" = true;