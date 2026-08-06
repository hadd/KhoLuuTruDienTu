ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "merge_json_path" text;--> statement-breakpoint
CREATE TABLE "sohoa_app"."metadata_extract_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" varchar(16) DEFAULT 'old' NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_extract_settings" ADD CONSTRAINT "metadata_extract_settings_updated_by_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
INSERT INTO "sohoa_app"."metadata_extract_settings" ("mode") VALUES ('old');
