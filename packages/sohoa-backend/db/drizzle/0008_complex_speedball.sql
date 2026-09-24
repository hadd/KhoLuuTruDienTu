CREATE TABLE "sohoa_app"."page_quota" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"used_pages" integer DEFAULT 0 NOT NULL,
	"used_pages_hmac" varchar(128),
	"page_limit" integer,
	"license_payload" text,
	"license_sig" text,
	"license_issued_at" timestamp with time zone,
	"license_id" varchar(64),
	"license_customer" varchar(255),
	"applied_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."page_quota_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"pages" integer NOT NULL,
	"charged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_naming_configs" ADD COLUMN "apply_on_approve" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."page_quota" ADD CONSTRAINT "page_quota_applied_by_id_user_profiles_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."page_quota_charges" ADD CONSTRAINT "page_quota_charges_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "page_quota_charges_dossier_id_unique" ON "sohoa_app"."page_quota_charges" USING btree ("dossier_id");