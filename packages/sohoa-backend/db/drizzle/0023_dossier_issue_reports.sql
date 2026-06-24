CREATE TYPE "sohoa_app"."issue_report_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'ESCALATED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "sohoa_app"."dossier_issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reporter_assignment_id" uuid NOT NULL,
	"target_role" "sohoa_app"."worker_role" NOT NULL,
	"status" "sohoa_app"."issue_report_status" DEFAULT 'PENDING' NOT NULL,
	"type" varchar(100) NOT NULL,
	"notes" text NOT NULL,
	"escalated_to_id" uuid,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_reporter_id_user_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_reporter_assignment_id_dossier_assignments_id_fk" FOREIGN KEY ("reporter_assignment_id") REFERENCES "sohoa_app"."dossier_assignments"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_escalated_to_id_user_profiles_id_fk" FOREIGN KEY ("escalated_to_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_issue_reports" ADD CONSTRAINT "dossier_issue_reports_resolved_by_id_user_profiles_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_issue_reports_dossier_status" ON "sohoa_app"."dossier_issue_reports" USING btree ("dossier_id","status");--> statement-breakpoint
CREATE INDEX "idx_issue_reports_escalated_to" ON "sohoa_app"."dossier_issue_reports" USING btree ("escalated_to_id","status");
