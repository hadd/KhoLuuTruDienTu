ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD COLUMN IF NOT EXISTS "file_id" uuid;
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD COLUMN IF NOT EXISTS "file_name" varchar(255);
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD COLUMN IF NOT EXISTS "fields" jsonb DEFAULT '[]'::jsonb;
DO $$ BEGIN
 ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE set null ON UPDATE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
