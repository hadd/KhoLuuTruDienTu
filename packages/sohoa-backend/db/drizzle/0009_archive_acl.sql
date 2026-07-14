CREATE TYPE "sohoa_app"."archive_acl_resource_kind" AS ENUM('fond', 'dossier_type', 'document_type');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_acl_principal_kind" AS ENUM('user', 'role');--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_acl_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_kind" "sohoa_app"."archive_acl_resource_kind" NOT NULL,
	"resource_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_acl_principals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"principal_kind" "sohoa_app"."archive_acl_principal_kind" NOT NULL,
	"principal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "dossier_type_id" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_acl_principals" ADD CONSTRAINT "archive_acl_principals_entry_id_archive_acl_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "sohoa_app"."archive_acl_entries"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_dossier_type_id_dossier_types_id_fk" FOREIGN KEY ("dossier_type_id") REFERENCES "sohoa_app"."dossier_types"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "archive_acl_entries_resource_perm_unique" ON "sohoa_app"."archive_acl_entries" USING btree ("resource_kind","resource_id","permission_key");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_entries_resource" ON "sohoa_app"."archive_acl_entries" USING btree ("resource_kind","resource_id");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_entries_permission" ON "sohoa_app"."archive_acl_entries" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_acl_principals_unique" ON "sohoa_app"."archive_acl_principals" USING btree ("entry_id","principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_principals_principal" ON "sohoa_app"."archive_acl_principals" USING btree ("principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "idx_archive_acl_principals_entry" ON "sohoa_app"."archive_acl_principals" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_dossiers_dossier_type_id" ON "sohoa_app"."dossiers" USING btree ("dossier_type_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;
