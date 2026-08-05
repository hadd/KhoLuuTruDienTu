CREATE TYPE "sohoa_app"."archive_borrow_annotation_kind" AS ENUM('BOOKMARK', 'HIGHLIGHT', 'NOTE');--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "sohoa_app"."archive_borrow_annotation_kind" NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"bbox" jsonb,
	"selected_text" text,
	"body" text,
	"color" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_reading_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_annotations" ADD CONSTRAINT "archive_borrow_annotations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_annotations" ADD CONSTRAINT "archive_borrow_annotations_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_annotations" ADD CONSTRAINT "archive_borrow_annotations_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_reading_progress" ADD CONSTRAINT "archive_borrow_reading_progress_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_reading_progress" ADD CONSTRAINT "archive_borrow_reading_progress_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_reading_progress" ADD CONSTRAINT "archive_borrow_reading_progress_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_annotations_user_request" ON "sohoa_app"."archive_borrow_annotations" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_annotations_request_file" ON "sohoa_app"."archive_borrow_annotations" USING btree ("request_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_annotations_kind" ON "sohoa_app"."archive_borrow_annotations" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_borrow_reading_progress_user_request_file" ON "sohoa_app"."archive_borrow_reading_progress" USING btree ("user_id","request_id","file_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_reading_progress_request" ON "sohoa_app"."archive_borrow_reading_progress" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_reading_progress_user_updated" ON "sohoa_app"."archive_borrow_reading_progress" USING btree ("user_id","updated_at");