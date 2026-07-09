CREATE TABLE "sohoa_app"."dossier_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."inventories" (
	"id" text PRIMARY KEY NOT NULL,
	"number" varchar(100) NOT NULL,
	"name" varchar(500) NOT NULL,
	"fond_id" text NOT NULL,
	"submission_year" integer NOT NULL,
	"submitting_unit" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."retention_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."inventories" ADD CONSTRAINT "inventories_fond_id_fonds_id_fk" FOREIGN KEY ("fond_id") REFERENCES "sohoa_app"."fonds"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_dossier_types_name" ON "sohoa_app"."dossier_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_inventories_name" ON "sohoa_app"."inventories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_inventories_number" ON "sohoa_app"."inventories" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_inventories_fond_id" ON "sohoa_app"."inventories" USING btree ("fond_id");--> statement-breakpoint
CREATE INDEX "idx_inventories_submission_year" ON "sohoa_app"."inventories" USING btree ("submission_year");--> statement-breakpoint
CREATE INDEX "idx_retention_periods_name" ON "sohoa_app"."retention_periods" USING btree ("name");