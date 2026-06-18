import { varchar, timestamp, uuid, integer, text, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { projects } from "./project.ts";
import { userProfiles } from "./user_profile.ts";

export const projectProgressHistories = schema.table("project_progress_histories", {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: varchar("project_code", { length: 50 }).notNull().references(() => projects.projectCode, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    extensionNumber: integer("extension_number").notNull(),
    previousAcceptanceDate: date("previous_acceptance_date"),
    newAcceptanceDate: date("new_acceptance_date").notNull(),
    changeReason: text("change_reason").notNull(),
    updatedBy: uuid("updated_by").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_project_progress_histories_project_code").on(table.projectCode),
    uniqueIndex("project_progress_histories_project_ext_unique")
        .on(table.projectCode, table.extensionNumber),
]);

export type ProjectProgressHistory = typeof projectProgressHistories.$inferSelect;
export type NewProjectProgressHistory = typeof projectProgressHistories.$inferInsert;
