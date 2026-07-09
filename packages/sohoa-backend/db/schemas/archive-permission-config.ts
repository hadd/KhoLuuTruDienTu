import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { archivePermissionSlots } from "./archive-permission-slot.ts";

export const archivePermissionConfigStatusEnum = schema.enum(
    "archive_permission_config_status",
    ["draft", "ready", "close"],
);

export const archivePermissionConfigs = schema.table("archive_permission_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: archivePermissionConfigStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("archive_permission_configs_active_idx")
        .on(table.id)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type ArchivePermissionConfig = typeof archivePermissionConfigs.$inferSelect;
export type NewArchivePermissionConfig = typeof archivePermissionConfigs.$inferInsert;

export const archivePermissionConfigsRelations = relations(
    archivePermissionConfigs,
    ({ many }) => ({
        slots: many(archivePermissionSlots),
    }),
);
