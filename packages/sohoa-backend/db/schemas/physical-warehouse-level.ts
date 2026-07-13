import { varchar, timestamp, index, uuid, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const physicalWarehouseLevels = schema.table("physical_warehouse_levels", {
    id: uuid("id").defaultRandom().primaryKey(),
    levelName: varchar("level_name", { length: 255 }).notNull(),
    levelOrder: integer("level_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("uq_physical_warehouse_levels_order").on(table.levelOrder),
    index("idx_physical_warehouse_levels_order").on(table.levelOrder),
]);

export type PhysicalWarehouseLevel = typeof physicalWarehouseLevels.$inferSelect;
export type NewPhysicalWarehouseLevel = typeof physicalWarehouseLevels.$inferInsert;
