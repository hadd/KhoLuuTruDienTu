CREATE TABLE "sohoa_app"."watermark_pdf_security" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"allow_printing" boolean DEFAULT true NOT NULL,
	"allow_changing" boolean DEFAULT false NOT NULL,
	"allow_document_assembly" boolean DEFAULT false NOT NULL,
	"allow_content_copying" boolean DEFAULT false NOT NULL,
	"allow_content_copying_accessibility" boolean DEFAULT true NOT NULL,
	"allow_page_extraction" boolean DEFAULT false NOT NULL,
	"allow_commenting" boolean DEFAULT false NOT NULL,
	"allow_form_filling" boolean DEFAULT true NOT NULL,
	"allow_signing" boolean DEFAULT false NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."fonds" ADD COLUMN "zip_password_encrypted" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."watermark_pdf_security" ADD CONSTRAINT "watermark_pdf_security_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "watermark_pdf_security_key_unique" ON "sohoa_app"."watermark_pdf_security" USING btree ("key");