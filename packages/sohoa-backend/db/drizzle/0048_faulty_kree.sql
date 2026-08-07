CREATE TABLE "sohoa_app"."archive_borrow_approval_clearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" text NOT NULL,
	"max_security_level_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_approval_clearances" ADD CONSTRAINT "archive_borrow_approval_clearances_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sohoa_app"."archive_borrow_approval_clearances" ADD CONSTRAINT "archive_borrow_approval_clearances_max_security_level_id_security_levels_id_fk" FOREIGN KEY ("max_security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_archive_borrow_approval_clearances_role" ON "sohoa_app"."archive_borrow_approval_clearances" USING btree ("role_id") WHERE "sohoa_app"."archive_borrow_approval_clearances"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_archive_borrow_approval_clearances_level" ON "sohoa_app"."archive_borrow_approval_clearances" USING btree ("max_security_level_id");