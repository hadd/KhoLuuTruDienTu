CREATE TYPE "sohoa_app"."archive_permission_config_status" AS ENUM('draft', 'ready', 'close');--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_group_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"config_id" uuid NOT NULL,
	"fond_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_permission_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "sohoa_app"."archive_permission_config_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_permission_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"slot_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"permission_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"field_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fond_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_user_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"fond_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD COLUMN "archive_permission_slot_code" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_group_bindings" ADD CONSTRAINT "archive_group_bindings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "sohoa_app"."groups"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_group_bindings" ADD CONSTRAINT "archive_group_bindings_config_id_archive_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."archive_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_permission_slots" ADD CONSTRAINT "archive_permission_slots_config_id_archive_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."archive_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_user_assignments" ADD CONSTRAINT "archive_user_assignments_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_user_assignments" ADD CONSTRAINT "archive_user_assignments_config_id_archive_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."archive_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_user_assignments" ADD CONSTRAINT "archive_user_assignments_assigned_by_user_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_group_bindings_group_unique" ON "sohoa_app"."archive_group_bindings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_archive_group_bindings_config" ON "sohoa_app"."archive_group_bindings" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "archive_permission_configs_active_idx" ON "sohoa_app"."archive_permission_configs" USING btree ("id") WHERE "sohoa_app"."archive_permission_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_permission_slots_config_code_unique" ON "sohoa_app"."archive_permission_slots" USING btree ("config_id","slot_code");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_user_assignments_user_config_slot_unique" ON "sohoa_app"."archive_user_assignments" USING btree ("user_id","config_id","slot_code");--> statement-breakpoint
CREATE INDEX "idx_archive_user_assignments_user" ON "sohoa_app"."archive_user_assignments" USING btree ("user_id");