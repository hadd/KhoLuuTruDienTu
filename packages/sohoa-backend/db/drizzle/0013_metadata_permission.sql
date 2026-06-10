CREATE TYPE "sohoa_app"."metadata_permission_config_status" AS ENUM('draft', 'ready');--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_dossier_id" uuid NOT NULL,
	"source_ocr_metadata_key" text NOT NULL,
	"field_catalog" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_permission_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template_id" uuid NOT NULL,
	"status" "sohoa_app"."metadata_permission_config_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_permission_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"slot_code" text NOT NULL,
	"slot_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"field_keys" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."groups" ADD COLUMN "metadata_permission_config_id" uuid;--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ADD COLUMN "permission_slot_code" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_templates" ADD CONSTRAINT "metadata_templates_source_dossier_id_dossiers_id_fk" FOREIGN KEY ("source_dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_permission_configs" ADD CONSTRAINT "metadata_permission_configs_template_id_metadata_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "sohoa_app"."metadata_templates"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_permission_slots" ADD CONSTRAINT "metadata_permission_slots_config_id_metadata_permission_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "sohoa_app"."metadata_permission_configs"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."groups" ADD CONSTRAINT "groups_metadata_permission_config_id_metadata_permission_configs_id_fk" FOREIGN KEY ("metadata_permission_config_id") REFERENCES "sohoa_app"."metadata_permission_configs"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "metadata_templates_name_idx" ON "sohoa_app"."metadata_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "metadata_templates_active_idx" ON "sohoa_app"."metadata_templates" USING btree ("id") WHERE "sohoa_app"."metadata_templates"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "metadata_permission_configs_template_idx" ON "sohoa_app"."metadata_permission_configs" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "metadata_permission_configs_active_idx" ON "sohoa_app"."metadata_permission_configs" USING btree ("id") WHERE "sohoa_app"."metadata_permission_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "metadata_permission_slots_config_code_unique" ON "sohoa_app"."metadata_permission_slots" USING btree ("config_id","slot_code");--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" DROP COLUMN IF EXISTS "allowed_fields";
