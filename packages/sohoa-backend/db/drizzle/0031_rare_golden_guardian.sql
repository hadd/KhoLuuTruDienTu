CREATE TABLE "sohoa_app"."document_naming_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fond_id" text NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"dossier_id" uuid,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"auto_increment_counter" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_naming_configs" ADD CONSTRAINT "document_naming_configs_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_naming_configs" ADD CONSTRAINT "document_naming_configs_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_naming_configs_fond_dossier" ON "sohoa_app"."document_naming_configs" USING btree ("fond_id") WHERE "sohoa_app"."document_naming_configs"."target_type" = 'dossier' AND "sohoa_app"."document_naming_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_naming_configs_fond_file" ON "sohoa_app"."document_naming_configs" USING btree ("fond_id","dossier_id") WHERE "sohoa_app"."document_naming_configs"."target_type" = 'file' AND "sohoa_app"."document_naming_configs"."deleted_at" IS NULL;