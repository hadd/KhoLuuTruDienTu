CREATE TABLE "sohoa_app"."metadata_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"actor_id" uuid,
	"role" "sohoa_app"."worker_role",
	"action" varchar(50) NOT NULL,
	"from_status" "sohoa_app"."dossier_status",
	"to_status" "sohoa_app"."dossier_status",
	"s3_key" text NOT NULL,
	"field_changes" jsonb,
	"version_number" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_history" ADD CONSTRAINT "metadata_history_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "sohoa_app"."dossiers"("id") ON DELETE cascade ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "sohoa_app"."metadata_history" ADD CONSTRAINT "metadata_history_actor_id_user_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "sohoa_app"."user_profiles"("id") ON DELETE set null ON UPDATE restrict;
--> statement-breakpoint
CREATE INDEX "idx_metadata_history_dossier" ON "sohoa_app"."metadata_history" USING btree ("dossier_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "metadata_history_dossier_version_unique" ON "sohoa_app"."metadata_history" USING btree ("dossier_id","version_number");
