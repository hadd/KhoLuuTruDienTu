import {
    varchar,
    timestamp,
    index,
    uuid,
    integer,
    text,
    boolean,
    type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

/**
 * Tree of physical warehouse nodes (free-form intermediate levels).
 * - parent_id = NULL → location (root)
 * - is_bottom_level = true → storage unit ("ô chứa"): fixed bottom level, no children,
 *   dossier placements only happen here. `capacity` = max number of placement units (items) it can hold.
 * - is_bottom_level = false → location / warehouse / intermediate node: may have children.
 *   `capacity` = max number of DIRECT children this node may have. NULL = unlimited.
 *
 * `is_bottom_level` is the single, explicit source of truth for what kind of node this is.
 * Do NOT re-derive it from `capacity` (e.g. `capacity != null`) anywhere in application code —
 * `capacity` now means two different things depending on `is_bottom_level`.
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
    mapsUrl: text("maps_url"),
    /**
     * Dual meaning based on isBottomLevel:
     * - isBottomLevel = true  → storage capacity (max placement units in this box).
     * - isBottomLevel = false → max number of direct children this level may hold.
     * NULL = unlimited in both cases.
     */
    capacity: integer("capacity"),
    /** Explicit discriminator: true = storage unit ("ô chứa", fixed bottom level), false = intermediate/warehouse/location. Source of truth — never re-derive from capacity elsewhere. */
    isBottomLevel: boolean("is_bottom_level").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_physical_warehouse_items_parent_id").on(table.parentId),
    index("idx_physical_warehouse_items_name").on(table.name),
]);

export type PhysicalWarehouseItem = typeof physicalWarehouseItems.$inferSelect;
export type NewPhysicalWarehouseItem = typeof physicalWarehouseItems.$inferInsert;