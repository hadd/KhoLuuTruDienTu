DROP INDEX "sohoa_app"."dossiers_folder_path_name_unique";--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_folder_path_name_unique" ON "sohoa_app"."dossiers" USING btree ("folder_path","name") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;