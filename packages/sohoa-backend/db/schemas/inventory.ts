import { varchar, timestamp, index, text, integer } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { fonds } from "./fond.ts";

export const inventories = schema.table("inventories", {
    id: text("id").primaryKey(),
    number: varchar("number", { length: 100 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    fondId: text("fond_id").notNull().references(() => fonds.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    submissionYear: integer("submission_year").notNull(),
    submittingUnit: varchar("submitting_unit", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_inventories_name").on(table.name),
    index("idx_inventories_number").on(table.number),
    index("idx_inventories_fond_id").on(table.fondId),
    index("idx_inventories_submission_year").on(table.submissionYear),
]);

export type Inventory = typeof inventories.$inferSelect;
export type NewInventory = typeof inventories.$inferInsert;
