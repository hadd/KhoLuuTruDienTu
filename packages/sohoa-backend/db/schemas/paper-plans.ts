import { sql } from "drizzle-orm";
import { index, integer, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { projectPlans } from "./project-plan.ts";
import { paperSizes } from "./paper-size.ts";

export const paperPlans = schema.table("paper_plans", {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
        .notNull()
        .references(() => projectPlans.id, { onDelete: "restrict", onUpdate: "restrict" }),
    paperSizeId: uuid("paper_size_id")
        .notNull()
        .references(() => paperSizes.id, { onDelete: "restrict", onUpdate: "restrict" }),
    quantity: integer("quantity").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    unique("uk_paper_plans_plan_size").on(table.planId, table.paperSizeId),
    index("idx_paper_plans_plan_size").on(table.planId, table.paperSizeId).where(sql`${table.deletedAt} IS NULL`),
    index("idx_paper_plans_active").on(table.id).where(sql`${table.deletedAt} IS NULL`),
]);

export type PaperPlan = typeof paperPlans.$inferSelect;
export type NewPaperPlan = typeof paperPlans.$inferInsert;
