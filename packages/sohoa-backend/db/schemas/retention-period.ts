import { timestamp, integer, boolean, text, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { retentionDurationUnitEnum } from "./retention-period-enums.ts";

export const retentionPeriods = schema.table("retention_periods", {
    id: text("id").primaryKey(),
    durationValue: integer("duration_value"),
    durationUnit: retentionDurationUnitEnum("duration_unit"),
    isPermanent: boolean("is_permanent").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_retention_periods_is_active").on(table.isActive)
        .where(sql`${table.isActive} = true`),
]);

export type RetentionPeriod = typeof retentionPeriods.$inferSelect;
export type NewRetentionPeriod = typeof retentionPeriods.$inferInsert;
