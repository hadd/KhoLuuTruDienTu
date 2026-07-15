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
import { physicalWarehouseLevels } from "./physical-warehouse-level.ts";

/**
 * Tree of physical warehouse nodes.
 * - parent_id = NULL, level_id = NULL → location (root)
 * - level_order = 1 → top configured level (e.g. Kho) — may have address + image
 * - middle levels → name only
 * - max level_order → lowest level (e.g. Hộp) — may have capacity
 */
export const physicalWarehouseItems = schema.table("physical_warehouse_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => physicalWarehouseItems.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    levelId: uuid("level_id").references(() => physicalWarehouseLevels.id, {
        onDelete: "restrict",
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
    index("idx_physical_warehouse_items_level_id").on(table.levelId),
    index("idx_physical_warehouse_items_name").on(table.name),
]);

export type PhysicalWarehouseItem = typeof physicalWarehouseItems.$inferSelect;
export type NewPhysicalWarehouseItem = typeof physicalWarehouseItems.$inferInsert;
