DROP INDEX "sohoa_app"."group_members_role_idx";--> statement-breakpoint
DROP INDEX "sohoa_app"."group_members_active_idx";--> statement-breakpoint
DROP INDEX "sohoa_app"."group_members_user_active_idx";--> statement-breakpoint
DROP INDEX "sohoa_app"."groups_active_idx";--> statement-breakpoint
ALTER TABLE "sohoa_app"."group_members" ALTER COLUMN "role" SET DEFAULT 'editor';--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_profiles" ADD COLUMN "active" boolean DEFAULT true NOT NULL;