ALTER TABLE "sohoa_app"."files" ADD COLUMN "ocr_run_mode" varchar(16) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "ocr_trigger_status" varchar(16);--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "ocr_triggered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "ocr_triggered_by" uuid;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_ocr_triggered_by_user_profiles_id_fk" FOREIGN KEY ("ocr_triggered_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_files_ocr_run_mode_trigger_status" ON "sohoa_app"."files" USING btree ("ocr_run_mode","ocr_trigger_status");