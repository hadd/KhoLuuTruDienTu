ALTER TABLE "sohoa_app"."dossier_assignments" ADD COLUMN "step_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "required_qc_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "current_qc_step" integer DEFAULT 0 NOT NULL;