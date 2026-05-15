import { varchar, timestamp, uuid, index, type AnyPgColumn } from "drizzle-orm/pg-core";
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
}, (table) => [
    index("idx_folders_path").on(table.folderPath),
]);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
