DROP INDEX "sohoa_app"."folders_folder_path_unique";--> statement-breakpoint
ALTER TABLE "sohoa_app"."folders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "folders_folder_path_unique" ON "sohoa_app"."folders" USING btree ("folder_path") WHERE "sohoa_app"."folders"."deleted_at" IS NULL;