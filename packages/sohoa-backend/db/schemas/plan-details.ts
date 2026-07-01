import { sql } from "drizzle-orm";
import { index, integer, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { projectPlans } from "./project-plan.ts";

export const planDetails = schema.table("plan_details", {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
        .notNull()
        .references(() => projectPlans.id, { onDelete: "restrict", onUpdate: "restrict" }),
    taskName: varchar("task_name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(0),
    unit: varchar("unit", { length: 50 }).notNull(),
    quota: integer("quota").notNull().default(0),
    dateCount: integer("date_count").notNull().default(0),
    workerCount: integer("worker_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_plan_details_active").on(table.id).where(sql`${table.deletedAt} IS NULL`),
]);

export type PlanDetail = typeof planDetails.$inferSelect;
export type NewPlanDetail = typeof planDetails.$inferInsert;
