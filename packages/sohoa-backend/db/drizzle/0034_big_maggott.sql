ALTER TABLE "sohoa_app"."user_profiles" DROP CONSTRAINT "user_profiles_security_level_id_security_levels_id_fk";
--> statement-breakpoint
DROP INDEX "sohoa_app"."idx_user_profiles_security_level_id";--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_profiles" DROP COLUMN "security_level_id";