import { sql } from "drizzle-orm";
import { date, index, integer, numeric, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { projects } from "./project.ts";

export const projectPlans = schema.table("project_plans", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    projectCode: varchar("project_code", { length: 50 })
        .notNull()
        .references(() => projects.projectCode, { onDelete: "restrict", onUpdate: "restrict" }),
    a4Pages: integer("a4_pages").notNull().default(0),
    a3Pages: integer("a3_pages").notNull().default(0),
    dossierCount: integer("dossier_count").notNull().default(0),
    quota: numeric("quota", { precision: 18, scale: 2 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_project_plans_project_code").on(table.projectCode),
    index("idx_project_plans_active").on(table.id).where(sql`${table.deletedAt} IS NULL`),
]);

export type ProjectPlan = typeof projectPlans.$inferSelect;
export type NewProjectPlan = typeof projectPlans.$inferInsert;
