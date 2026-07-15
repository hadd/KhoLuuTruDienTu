CREATE TABLE "sohoa_app"."document_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"retention_period_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "document_type_id" text;--> statement-breakpoint
ALTER TABLE "sohoa_app"."document_types" ADD CONSTRAINT "document_types_retention_period_id_retention_periods_id_fk" FOREIGN KEY ("retention_period_id") REFERENCES "sohoa_app"."retention_periods"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_document_types_name" ON "sohoa_app"."document_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_document_types_retention_period_id" ON "sohoa_app"."document_types" USING btree ("retention_period_id");--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "sohoa_app"."document_types"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_files_document_type_id" ON "sohoa_app"."files" USING btree ("document_type_id");