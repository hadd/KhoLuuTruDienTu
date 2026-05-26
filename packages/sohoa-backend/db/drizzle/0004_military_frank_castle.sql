ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'WAITING_CHECKER_3' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'CHECKER_3_PROCESSING' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'CHECKER_3_REJECTED' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'WAITING_CHECKER_4' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'CHECKER_4_PROCESSING' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'CHECKER_4_REJECTED' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'WAITING_CHECKER_5' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'CHECKER_5_PROCESSING' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."dossier_status" ADD VALUE 'CHECKER_5_REJECTED' BEFORE 'APPROVED';--> statement-breakpoint
ALTER TYPE "sohoa_app"."worker_role" ADD VALUE 'CHECKER_3';--> statement-breakpoint
ALTER TYPE "sohoa_app"."worker_role" ADD VALUE 'CHECKER_4';--> statement-breakpoint
ALTER TYPE "sohoa_app"."worker_role" ADD VALUE 'CHECKER_5';