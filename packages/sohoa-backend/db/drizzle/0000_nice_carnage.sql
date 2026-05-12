CREATE TYPE "sohoa_app"."auth_session_token_type" AS ENUM('access_token', 'refresh_token');--> statement-breakpoint
CREATE TABLE "sohoa_app"."api_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(50),
	"user_id" uuid,
	"user_role" varchar(50),
	"method" varchar(10) NOT NULL,
	"path" varchar(500) NOT NULL,
	"query" jsonb,
	"action" varchar(100),
	"status_code" integer NOT NULL,
	"response_time" integer,
	"ip" varchar(50),
	"user_agent" text,
	"request_body" jsonb,
	"response_body" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."auth_session_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "sohoa_app"."auth_session_token_type" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" text NOT NULL,
	"is_base_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"avatar_url" text,
	"date_of_birth" date,
	"gender" varchar(50),
	"phone" varchar(50),
	"address" text,
	"last_login_at" timestamp with time zone,
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sohoa_app"."user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."api_audit_logs" ADD CONSTRAINT "api_audit_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_session_tokens" ADD CONSTRAINT "auth_session_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sohoa_app"."auth_sessions"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_session_tokens" ADD CONSTRAINT "auth_session_tokens_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_roles" ADD CONSTRAINT "user_roles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "sohoa_app"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "sohoa_app"."roles"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "api_audit_logs_request_id_idx" ON "sohoa_app"."api_audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "api_audit_logs_user_id_idx" ON "sohoa_app"."api_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_audit_logs_action_idx" ON "sohoa_app"."api_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "api_audit_logs_status_code_idx" ON "sohoa_app"."api_audit_logs" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "api_audit_logs_created_at_idx" ON "sohoa_app"."api_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_user_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_user_action_idx" ON "sohoa_app"."api_audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "api_audit_logs_status_created_idx" ON "sohoa_app"."api_audit_logs" USING btree ("status_code","created_at");--> statement-breakpoint
CREATE INDEX "api_audit_logs_created_at_desc_idx" ON "sohoa_app"."api_audit_logs" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "api_audit_logs_errors_idx" ON "sohoa_app"."api_audit_logs" USING btree ("status_code","created_at") WHERE "sohoa_app"."api_audit_logs"."status_code" >= 400;--> statement-breakpoint
CREATE INDEX "auth_session_tokens_session_type_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("session_id","type");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_user_expires_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "auth_session_tokens_hash_active_idx" ON "sohoa_app"."auth_session_tokens" USING btree ("token_hash") WHERE "sohoa_app"."auth_session_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "sohoa_app"."auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_idx" ON "sohoa_app"."auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_active_idx" ON "sohoa_app"."auth_sessions" USING btree ("user_id") WHERE "sohoa_app"."auth_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "roles_name_idx" ON "sohoa_app"."roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "roles_is_base_role_idx" ON "sohoa_app"."roles" USING btree ("is_base_role");--> statement-breakpoint
CREATE INDEX "roles_active_idx" ON "sohoa_app"."roles" USING btree ("name","is_base_role") WHERE "sohoa_app"."roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_active_idx" ON "sohoa_app"."user_profiles" USING btree ("email") WHERE "sohoa_app"."user_profiles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_profiles_active_idx" ON "sohoa_app"."user_profiles" USING btree ("email","full_name") WHERE "sohoa_app"."user_profiles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "sohoa_app"."user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "sohoa_app"."user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_roles_expired_at_idx" ON "sohoa_app"."user_roles" USING btree ("expired_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_active_unique" ON "sohoa_app"."user_roles" USING btree ("user_id","role_id") WHERE "sohoa_app"."user_roles"."expired_at" IS NULL;