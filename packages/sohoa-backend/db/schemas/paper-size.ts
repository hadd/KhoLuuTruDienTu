import { sql } from "drizzle-orm";
import { index, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const paperSizes = schema.table("paper_sizes", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 50 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_paper_sizes").on(table.id),
    index("idx_paper_sizes_active").on(table.id).where(sql`${table.deletedAt} IS NULL`),
]);

export type PaperSize = typeof paperSizes.$inferSelect;
export type NewPaperSize = typeof paperSizes.$inferInsert;