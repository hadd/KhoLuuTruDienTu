CREATE TABLE "sohoa_app"."metadata_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata_extract_mode_code" text NOT NULL,
	"group_code" varchar(100),
	"field_code" varchar(100) NOT NULL,
	"description" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_metadata_fields_field_code" ON "sohoa_app"."metadata_fields" USING btree ("field_code");--> statement-breakpoint
CREATE INDEX "idx_metadata_fields_group_code" ON "sohoa_app"."metadata_fields" USING btree ("group_code");