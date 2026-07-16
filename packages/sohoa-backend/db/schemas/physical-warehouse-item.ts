import {
    varchar,
    timestamp,
    index,
    uuid,
    integer,
    text,
    type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

/**
 * Tree of physical warehouse nodes (free-form intermediate levels).
 * - parent_id = NULL → location (root)
 * - capacity IS NULL, parent set → intermediate node (may have children)
 * - capacity IS NOT NULL → storage unit (fixed bottom level; no children; placements only here)
 */
export const physicalWarehouseItems = schema.table("physical_warehouse_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => physicalWarehouseItems.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    name: varchar("name", { length: 500 }).notNull(),
    imageUrl: text("image_url"),
    address: text("address"),
    capacity: integer("capacity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_physical_warehouse_items_parent_id").on(table.parentId),
    index("idx_physical_warehouse_items_name").on(table.name),
]);

export type PhysicalWarehouseItem = typeof physicalWarehouseItems.$inferSelect;
export type NewPhysicalWarehouseItem = typeof physicalWarehouseItems.$inferInsert;
