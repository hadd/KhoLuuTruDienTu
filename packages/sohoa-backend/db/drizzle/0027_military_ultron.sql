CREATE TABLE "sohoa_app"."fonds" (
	"id" text PRIMARY KEY NOT NULL,
	"fond_name" varchar(255) NOT NULL,
	"archive_agency" varchar(255) NOT NULL,
	"dossier_count" integer DEFAULT 0 NOT NULL,
	"adminstrative_history" text NOT NULL,
	"fond_type" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "fond_id" text;--> statement-breakpoint
CREATE INDEX "idx_fonds_name" ON "sohoa_app"."fonds" USING btree ("fond_name");--> statement-breakpoint
CREATE INDEX "idx_fonds_type" ON "sohoa_app"."fonds" USING btree ("fond_type");--> statement-breakpoint
CREATE INDEX "idx_fonds_archive_agency" ON "sohoa_app"."fonds" USING btree ("archive_agency") WHERE "sohoa_app"."fonds"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE restrict ON UPDATE restrict;