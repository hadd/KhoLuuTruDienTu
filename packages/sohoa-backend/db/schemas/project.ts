import { varchar, timestamp, text, date, numeric, index, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { ProjectStatus } from "./project-constants.ts";
import { userProfiles } from "./user_profile.ts";

export const projects = schema.table("projects", {
    projectCode: varchar("project_code", { length: 50 }).primaryKey(),
    projectName: varchar("project_name", { length: 255 }).notNull(),
    projectType: varchar("project_type", { length: 100 }),
    investor: text("investor"),
    startDate: date("start_date"),
    acceptanceDate: date("acceptance_date"),
    totalInvestment: numeric("total_investment", { precision: 18, scale: 2 }),
    status: varchar("status", { length: 50 }).notNull().default(ProjectStatus.IN_PROGRESS),
    managerId: uuid("manager_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_projects_status").on(table.status)
        .where(sql`${table.deletedAt} IS NULL`),
    index("idx_projects_name").on(table.projectName),
    index("idx_projects_manager_id").on(table.managerId)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
