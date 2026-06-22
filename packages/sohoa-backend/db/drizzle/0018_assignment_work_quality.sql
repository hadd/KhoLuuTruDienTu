CREATE TYPE "sohoa_app"."work_quality" AS ENUM('CORRECT', 'INCORRECT');--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossier_assignments" ADD COLUMN "work_quality" "sohoa_app"."work_quality";
