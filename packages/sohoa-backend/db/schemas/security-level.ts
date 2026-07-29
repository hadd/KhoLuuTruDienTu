import { varchar, timestamp, index, uniqueIndex, integer, text, boolean, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

export const securityLevels = schema.table("security_levels", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull().default(""),
    levelOrder: integer("level_order").notNull(),
    /** Hash mật khẩu hồ sơ dùng chung theo cấp — không kế thừa giữa các cấp. */
    passwordHash: varchar("password_hash", { length: 255 }),
    /** Hash mật khẩu file dùng chung theo cấp — JWT unlock theo từng fileId. */
    filePasswordHash: varchar("file_password_hash", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("security_levels_name_lower_unique")
        .on(sql`lower(${table.name})`)
        .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("security_levels_level_order_unique")
        .on(table.levelOrder)
        .where(sql`${table.deletedAt} IS NULL`),
    index("idx_security_levels_is_active").on(table.isActive)
        .where(sql`${table.isActive} = true`),
]);

export type SecurityLevel = typeof securityLevels.$inferSelect;
export type NewSecurityLevel = typeof securityLevels.$inferInsert;
