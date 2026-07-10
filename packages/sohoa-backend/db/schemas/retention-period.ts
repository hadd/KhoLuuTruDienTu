import { varchar, timestamp, index, text, integer, boolean } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { retentionDurationUnitEnum } from "./retention-period-enums.ts";

export const retentionPeriods = schema.table("retention_periods", {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    durationValue: integer("duration_value"),
    durationUnit: retentionDurationUnitEnum("duration_unit"),
    isPermanent: boolean("is_permanent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_retention_periods_name").on(table.name),
]);

export type RetentionPeriod = typeof retentionPeriods.$inferSelect;
export type NewRetentionPeriod = typeof retentionPeriods.$inferInsert;
