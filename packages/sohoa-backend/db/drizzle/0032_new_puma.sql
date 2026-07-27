CREATE TABLE "sohoa_app"."security_level_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_level_id" uuid NOT NULL,
	"rule_key" varchar(96) NOT NULL,
	"is_overridden" boolean DEFAULT false NOT NULL,
	"value" jsonb DEFAULT 'false'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."security_permission_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "security_level_id" uuid;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "security_level_id" uuid;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "access_password_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "access_password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_profiles" ADD COLUMN "security_level_id" uuid;--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_level_rules" ADD CONSTRAINT "security_level_rules_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "security_level_rules_level_rule_unique" ON "sohoa_app"."security_level_rules" USING btree ("security_level_id","rule_key");--> statement-breakpoint
CREATE INDEX "idx_security_level_rules_level_id" ON "sohoa_app"."security_level_rules" USING btree ("security_level_id");--> statement-breakpoint
CREATE INDEX "idx_security_level_rules_rule_key" ON "sohoa_app"."security_level_rules" USING btree ("rule_key");--> statement-breakpoint
CREATE UNIQUE INDEX "security_permission_defs_key_unique" ON "sohoa_app"."security_permission_defs" USING btree ("key") WHERE "sohoa_app"."security_permission_defs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_security_permission_defs_is_active" ON "sohoa_app"."security_permission_defs" USING btree ("is_active") WHERE "sohoa_app"."security_permission_defs"."is_active" = true;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD CONSTRAINT "files_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."dossiers" ADD CONSTRAINT "dossiers_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_profiles" ADD CONSTRAINT "user_profiles_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "sohoa_app"."security_levels"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_files_security_level_id" ON "sohoa_app"."files" USING btree ("security_level_id");--> statement-breakpoint
CREATE INDEX "idx_dossiers_security_level_id" ON "sohoa_app"."dossiers" USING btree ("security_level_id") WHERE "sohoa_app"."dossiers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_profiles_security_level_id" ON "sohoa_app"."user_profiles" USING btree ("security_level_id");--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" DROP COLUMN "require_encryption";--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" DROP COLUMN "require_watermark";--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" DROP COLUMN "export_role_ids";