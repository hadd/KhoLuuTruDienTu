import { varchar, timestamp, uuid, index, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

export const folders = schema.table("folders", {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    folderPath: varchar("folder_path", { length: 500 }).notNull(),
    folderName: varchar("folder_name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_folders_path").on(table.folderPath),
    uniqueIndex("folders_folder_path_unique")
        .on(table.folderPath)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
