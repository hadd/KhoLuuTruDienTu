import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { userProfiles } from "./user_profile.ts";
import { archiveSubmissionStatusEnum } from "./archive-enums.ts";
import type { ArchiveFieldConfig } from "./archive-field-config.ts";

export type ArchiveFieldValueSnapshot = Record<string, unknown>;

export type ArchiveFieldConfigSnapshot = {
    fields: Array<ArchiveFieldConfig>;
    resolvedLabels: Record<string, { id: string; label: string }>;
};

export const archiveSubmissions = schema.table("archive_submissions", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    submittedBy: uuid("submitted_by").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    status: archiveSubmissionStatusEnum("status").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectNotes: text("reject_notes"),
    fieldValues: jsonb("field_values").$type<ArchiveFieldValueSnapshot>().notNull(),
    fieldConfigSnapshot: jsonb("field_config_snapshot").$type<ArchiveFieldConfigSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_archive_submissions_dossier").on(table.dossierId),
    index("idx_archive_submissions_status").on(table.status),
    index("idx_archive_submissions_submitted_at").on(table.submittedAt),
]);

export type ArchiveSubmission = typeof archiveSubmissions.$inferSelect;
export type NewArchiveSubmission = typeof archiveSubmissions.$inferInsert;

export const archiveSubmissionsRelations = relations(archiveSubmissions, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [archiveSubmissions.dossierId],
        references: [dossiers.id],
    }),
    submitter: one(userProfiles, {
        fields: [archiveSubmissions.submittedBy],
        references: [userProfiles.id],
        relationName: "archiveSubmissionSubmitter",
    }),
    reviewer: one(userProfiles, {
        fields: [archiveSubmissions.reviewedBy],
        references: [userProfiles.id],
        relationName: "archiveSubmissionReviewer",
    }),
}));
