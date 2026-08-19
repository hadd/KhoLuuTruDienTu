ALTER TABLE "sohoa_app"."document_naming_configs" DROP CONSTRAINT "document_naming_configs_dossier_id_dossiers_id_fk";
--> statement-breakpoint
ALTER TABLE "sohoa_app"."roles" ADD COLUMN "hidden_permissions" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_naming_configs" ADD CONSTRAINT "document_naming_configs_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE no action;