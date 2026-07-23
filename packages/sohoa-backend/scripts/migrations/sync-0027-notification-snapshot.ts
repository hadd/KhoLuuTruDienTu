const root = new URL("../../db/drizzle/", import.meta.url);
const snapshotPath = new URL("meta/0026_snapshot.json", root);
const outSnapshotPath = new URL("meta/0027_snapshot.json", root);
const migrationPath = new URL("0027_optimize_notifications.sql", root);
const journalPath = new URL("meta/_journal.json", root);

const textArrayColumn = {
  name: "",
  type: "text[]",
  primaryKey: false,
  notNull: true,
  default: "'{}'",
};

const snapshot = JSON.parse(await Deno.readTextFile(snapshotPath));
const tables = snapshot.tables as Record<string, Record<string, unknown>>;

delete tables["sohoa_app.notification_config_channels"];
delete tables["sohoa_app.notification_config_roles"];
delete tables["sohoa_app.notification_deliveries"];

if (snapshot.enums) {
  delete (snapshot.enums as Record<string, unknown>)["sohoa_app.notification_delivery_status"];
}

const notificationConfigs = tables["sohoa_app.notification_configs"] as {
  columns: Record<string, unknown>;
  indexes: Record<string, unknown>;
};
delete notificationConfigs.columns.dedupe_key;
notificationConfigs.columns.channels = { ...textArrayColumn, name: "channels" };
notificationConfigs.columns.role_ids = { ...textArrayColumn, name: "role_ids" };
delete notificationConfigs.indexes.notification_configs_dedupe_unique;

const notifications = tables["sohoa_app.notifications"] as {
  columns: Record<string, unknown>;
};
delete notifications.columns.entity_type;
delete notifications.columns.entity_id;
delete notifications.columns.payload;

const emailSender = tables["sohoa_app.email_sender_configs"] as {
  columns: Record<string, unknown>;
  indexes: Record<string, unknown>;
};
delete emailSender.columns.key;
delete emailSender.indexes.email_sender_configs_key_unique;
emailSender.columns.smtp_host = {
  name: "smtp_host",
  type: "varchar(255)",
  primaryKey: false,
  notNull: false,
};
emailSender.columns.smtp_port = {
  name: "smtp_port",
  type: "integer",
  primaryKey: false,
  notNull: true,
  default: 587,
};
emailSender.columns.smtp_secure = {
  name: "smtp_secure",
  type: "boolean",
  primaryKey: false,
  notNull: true,
  default: false,
};
emailSender.columns.smtp_user = {
  name: "smtp_user",
  type: "varchar(255)",
  primaryKey: false,
  notNull: false,
};

snapshot.id = crypto.randomUUID();
snapshot.prevId = JSON.parse(await Deno.readTextFile(snapshotPath)).id;

await Deno.writeTextFile(
  outSnapshotPath,
  `${JSON.stringify(snapshot, null, 2)}\n`,
);

const migrationSql = `-- notification_configs: merge junction tables into array columns
ALTER TABLE "sohoa_app"."notification_configs" ADD COLUMN IF NOT EXISTS "channels" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" ADD COLUMN IF NOT EXISTS "role_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'sohoa_app'
      AND table_name = 'notification_config_channels'
  ) THEN
    UPDATE "sohoa_app"."notification_configs" AS nc SET
      "channels" = COALESCE((
        SELECT array_agg(ncc."channel" ORDER BY ncc."channel")
        FROM "sohoa_app"."notification_config_channels" AS ncc
        WHERE ncc."config_id" = nc."id"
      ), '{}'),
      "role_ids" = COALESCE((
        SELECT array_agg(ncr."role_id" ORDER BY ncr."role_id")
        FROM "sohoa_app"."notification_config_roles" AS ncr
        WHERE ncr."config_id" = nc."id"
      ), '{}');
  END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "sohoa_app"."notification_configs_dedupe_unique";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notification_configs" DROP COLUMN IF EXISTS "dedupe_key";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."notification_config_channels";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."notification_config_roles";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" DROP COLUMN IF EXISTS "entity_type";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" DROP COLUMN IF EXISTS "entity_id";--> statement-breakpoint
ALTER TABLE "sohoa_app"."notifications" DROP COLUMN IF EXISTS "payload";--> statement-breakpoint
DROP TABLE IF EXISTS "sohoa_app"."notification_deliveries";--> statement-breakpoint
DROP TYPE IF EXISTS "sohoa_app"."notification_delivery_status";--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_host" varchar(255);--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_port" integer DEFAULT 587 NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_secure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" ADD COLUMN IF NOT EXISTS "smtp_user" varchar(255);--> statement-breakpoint
DROP INDEX IF EXISTS "sohoa_app"."email_sender_configs_key_unique";--> statement-breakpoint
ALTER TABLE "sohoa_app"."email_sender_configs" DROP COLUMN IF EXISTS "key";
`;

await Deno.writeTextFile(migrationPath, migrationSql);

const journal = JSON.parse(await Deno.readTextFile(journalPath));
if (!journal.entries.some((entry: { tag: string }) => entry.tag === "0027_optimize_notifications")) {
  journal.entries.push({
    idx: 27,
    version: "7",
    when: Date.now(),
    tag: "0027_optimize_notifications",
    breakpoints: true,
  });
  await Deno.writeTextFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
}

console.log("Synced 0027 migration SQL and snapshot from schema.");
