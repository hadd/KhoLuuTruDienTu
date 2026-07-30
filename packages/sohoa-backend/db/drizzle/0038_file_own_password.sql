ALTER TABLE "sohoa_app"."dossiers" ADD COLUMN "password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" ADD COLUMN "password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."security_levels" ADD COLUMN "file_password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "access_password_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "access_password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."files" ADD COLUMN "password_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
INSERT INTO "sohoa_app"."security_permission_defs" ("key", "name", "description", "is_system", "is_active")
SELECT v.key, v.name, v.description, true, true
FROM (VALUES
  (
    'require_access_password',
    'Yêu cầu mật khẩu hồ sơ',
    'Xem/tải hồ sơ thuộc cấp này phải nhập mật khẩu hồ sơ (token theo từng hồ sơ)'
  ),
  (
    'require_file_password',
    'Yêu cầu mật khẩu file',
    'Xem/tải từng file thuộc cấp này phải nhập mật khẩu file (token theo từng file)'
  )
) AS v(key, name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM "sohoa_app"."security_permission_defs" existing
  WHERE existing."key" = v.key
    AND existing."deleted_at" IS NULL
);
