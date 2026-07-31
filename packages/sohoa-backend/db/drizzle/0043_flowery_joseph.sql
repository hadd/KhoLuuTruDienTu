CREATE TYPE "sohoa_app"."archive_borrow_dip_layout" AS ENUM('ZIP', 'UNPACKED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_dip_status" AS ENUM('PENDING', 'READY', 'FAILED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_item_kind" AS ENUM('FILE', 'DOSSIER', 'PHYSICAL_DOSSIER');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_medium" AS ENUM('ELECTRONIC', 'PHYSICAL');--> statement-breakpoint
CREATE TYPE "sohoa_app"."archive_borrow_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED', 'DELIVERED', 'RETURNED');--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_dip_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"status" "sohoa_app"."archive_borrow_dip_status" DEFAULT 'PENDING' NOT NULL,
	"storage_key" text,
	"layout" "sohoa_app"."archive_borrow_dip_layout" DEFAULT 'UNPACKED' NOT NULL,
	"manifest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checksum" varchar(64),
	"byte_size" integer,
	"has_watermark" boolean DEFAULT false NOT NULL,
	"is_encrypted" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"item_kind" "sohoa_app"."archive_borrow_item_kind" NOT NULL,
	"dossier_id" uuid NOT NULL,
	"file_id" uuid,
	"file_ids_snapshot" jsonb,
	"physical_placement_id" uuid,
	"physical_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."archive_borrow_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medium" "sohoa_app"."archive_borrow_medium" NOT NULL,
	"requester_id" uuid NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" "sohoa_app"."archive_borrow_status" NOT NULL,
	"requested_from" timestamp with time zone,
	"requested_until" timestamp with time zone,
	"approved_from" timestamp with time zone,
	"approved_until" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"activated_at" timestamp with time zone,
	"activated_by" uuid,
	"delivered_at" timestamp with time zone,
	"delivered_by" uuid,
	"returned_at" timestamp with time zone,
	"returned_by" uuid,
	"delivery_notes" text,
	"return_notes" text,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_dip_packages" ADD CONSTRAINT "archive_borrow_dip_packages_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_request_id_archive_borrow_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "sohoa_app"."archive_borrow_requests"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "sohoa_app"."files"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_physical_placement_id_dossier_physical_placements_id_fk" FOREIGN KEY ("physical_placement_id") REFERENCES "sohoa_app"."dossier_physical_placements"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_items" ADD CONSTRAINT "archive_borrow_items_physical_item_id_physical_warehouse_items_id_fk" FOREIGN KEY ("physical_item_id") REFERENCES "sohoa_app"."physical_warehouse_items"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_requester_id_user_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_activated_by_user_profiles_id_fk" FOREIGN KEY ("activated_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_delivered_by_user_profiles_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_requests" ADD CONSTRAINT "archive_borrow_requests_returned_by_user_profiles_id_fk" FOREIGN KEY ("returned_by") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_borrow_dip_packages_request_id" ON "sohoa_app"."archive_borrow_dip_packages" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_dip_packages_status" ON "sohoa_app"."archive_borrow_dip_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_request_id" ON "sohoa_app"."archive_borrow_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_dossier_id" ON "sohoa_app"."archive_borrow_items" USING btree ("dossier_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_file_id" ON "sohoa_app"."archive_borrow_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_items_physical_placement_id" ON "sohoa_app"."archive_borrow_items" USING btree ("physical_placement_id");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_medium_status_created" ON "sohoa_app"."archive_borrow_requests" USING btree ("medium","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_requester_created" ON "sohoa_app"."archive_borrow_requests" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_status_approved_until" ON "sohoa_app"."archive_borrow_requests" USING btree ("status","approved_until");--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_requests_medium_status" ON "sohoa_app"."archive_borrow_requests" USING btree ("medium","status");