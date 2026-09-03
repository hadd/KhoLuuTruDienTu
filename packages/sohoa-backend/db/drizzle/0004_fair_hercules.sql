CREATE TABLE "sohoa_app"."auth_two_factor_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_token" varchar(255) NOT NULL,
	"otp_hash" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."auth_two_factor_otps" ADD CONSTRAINT "auth_two_factor_otps_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE cascade ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "auth_2fa_challenge_idx" ON "sohoa_app"."auth_two_factor_otps" USING btree ("challenge_token");--> statement-breakpoint
CREATE INDEX "auth_2fa_user_idx" ON "sohoa_app"."auth_two_factor_otps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_2fa_active_idx" ON "sohoa_app"."auth_two_factor_otps" USING btree ("challenge_token") WHERE "sohoa_app"."auth_two_factor_otps"."used_at" IS NULL;