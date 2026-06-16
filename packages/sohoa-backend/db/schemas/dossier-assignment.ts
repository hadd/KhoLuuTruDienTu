import { timestamp, uuid, index, integer, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { userProfiles } from "./user_profile.ts";
import { workerRoleEnum, assignmentStatusEnum } from "./workflow-enums.ts";

export const dossierAssignments = schema.table("dossier_assignments", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }), 
    role: workerRoleEnum("role").notNull(),
    assigneeId: uuid("assignee_id").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    metadataKey: text("metadata_key"),
    allowedFields: text("allowed_fields"),
    rejectFields: text("reject_fields"),
    attemptNumber: integer("attempt_number").notNull().default(1),
    stepNumber: integer("step_number").notNull().default(1), // QC vòng 1, 2 hay 3?
    status: assignmentStatusEnum("status").notNull().default("IN_PROGRESS"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
    index("idx_assignments_user").on(table.assigneeId, table.status, table.role),
]);

export type DossierAssignment = typeof dossierAssignments.$inferSelect;
export type NewDossierAssignment = typeof dossierAssignments.$inferInsert;

export const dossierAssignmentsRelations = relations(dossierAssignments, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [dossierAssignments.dossierId],
        references: [dossiers.id],
    }),
    assignee: one(userProfiles, {
        fields: [dossierAssignments.assigneeId],
        references: [userProfiles.id],
    }),
}));
