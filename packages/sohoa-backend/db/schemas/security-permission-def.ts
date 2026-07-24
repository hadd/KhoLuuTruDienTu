import { varchar, timestamp, index, uniqueIndex, text, boolean, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

/** Danh mục quyền bảo mật Nhóm 1 (CRUD bởi Admin). */
export const securityPermissionDefs = schema.table("security_permission_defs", {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull().default(""),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("security_permission_defs_key_unique")
        .on(table.key)
        .where(sql`${table.deletedAt} IS NULL`),
    index("idx_security_permission_defs_is_active").on(table.isActive)
        .where(sql`${table.isActive} = true`),
]);

export type SecurityPermissionDef = typeof securityPermissionDefs.$inferSelect;
export type NewSecurityPermissionDef = typeof securityPermissionDefs.$inferInsert;
