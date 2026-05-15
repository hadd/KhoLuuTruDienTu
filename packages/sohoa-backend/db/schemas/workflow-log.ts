import { varchar, timestamp, uuid, index, integer, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { userProfiles } from "./user_profile.ts";
import { dossierStatusEnum } from "./workflow-enums.ts";

export const workflowLogs = schema.table("workflow_logs", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    actorId: uuid("actor_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    action: varchar("action", { length: 50 }).notNull(),
    fromStatus: dossierStatusEnum("from_status"),
    toStatus: dossierStatusEnum("to_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_workflow_logs_dossier").on(table.dossierId),
]);

export type WorkflowLog = typeof workflowLogs.$inferSelect;
export type NewWorkflowLog = typeof workflowLogs.$inferInsert;

export const workflowLogsRelations = relations(workflowLogs, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [workflowLogs.dossierId],
        references: [dossiers.id],
    }),
    actor: one(userProfiles, {
        fields: [workflowLogs.actorId],
        references: [userProfiles.id],
    }),
}));
