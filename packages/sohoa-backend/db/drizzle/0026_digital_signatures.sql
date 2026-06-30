ALTER TABLE "sohoa_app"."files" ADD COLUMN "signed_file_path" text;
ALTER TABLE "sohoa_app"."files" ADD COLUMN "signed_at" timestamp with time zone;

CREATE TABLE "sohoa_app"."digital_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"signed_by" uuid,
	"certificate_subject" text NOT NULL,
	"certificate_thumbprint" varchar(128) NOT NULL,
	"certificate_issuer" text NOT NULL,
	"certificate_valid_from" timestamp with time zone,
	"certificate_valid_to" timestamp with time zone,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "sohoa_app"."digital_signatures" ADD CONSTRAINT "digital_signatures_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE cascade ON UPDATE restrict;
ALTER TABLE "sohoa_app"."digital_signatures" ADD CONSTRAINT "digital_signatures_signed_by_user_profiles_id_fk" FOREIGN KEY ("signed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;

CREATE INDEX "idx_digital_signatures_file" ON "sohoa_app"."digital_signatures" USING btree ("file_id");
CREATE INDEX "idx_digital_signatures_signed_by" ON "sohoa_app"."digital_signatures" USING btree ("signed_by");
