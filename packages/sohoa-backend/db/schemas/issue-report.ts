import { timestamp, uuid, index, text, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { dossierAssignments } from "./dossier-assignment.ts";
import { dossierFiles } from "./dossier-file.ts";
import { userProfiles } from "./user_profile.ts";
import { issueReportStatusEnum } from "./issue-report-enums.ts";
import { workerRoleEnum } from "./workflow-enums.ts";
import { IssueReportStatus } from "./issue-report-constants.ts";

export const dossierIssueReports = schema.table("dossier_issue_reports", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    reporterId: uuid("reporter_id").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    reporterAssignmentId: uuid("reporter_assignment_id").notNull().references(
        () => dossierAssignments.id,
        { onDelete: "restrict", onUpdate: "restrict" },
    ),
    targetRole: workerRoleEnum("target_role").notNull(),
    status: issueReportStatusEnum("status").notNull().default(IssueReportStatus.PENDING),
    type: varchar("type", { length: 100 }).notNull(),
    notes: text("notes").notNull(),
    /** ID của file tài liệu bị lỗi (tùy chọn) */
    fileId: uuid("file_id").references(() => dossierFiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    /** Tên file tài liệu bị lỗi (lưu snapshot hiển thị nhanh) */
    fileName: varchar("file_name", { length: 255 }),
    /** Danh sách mã các trường dữ liệu bị báo lỗi (vd: ["THONG_TIN_CHUNG:file1.so_ky_hieu"]) */
    fields: jsonb("fields").$type<string[]>().default([]),
    /** Ghi chú lý do từ chối (khi checker từ chối issue report). */
    resolveNotes: text("resolve_notes"),
    escalatedToId: uuid("escalated_to_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    resolvedById: uuid("resolved_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_issue_reports_dossier_status").on(table.dossierId, table.status),
    index("idx_issue_reports_escalated_to").on(table.escalatedToId, table.status),
]);

export type DossierIssueReport = typeof dossierIssueReports.$inferSelect;
export type NewDossierIssueReport = typeof dossierIssueReports.$inferInsert;

export const dossierIssueReportsRelations = relations(dossierIssueReports, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [dossierIssueReports.dossierId],
        references: [dossiers.id],
    }),
    reporter: one(userProfiles, {
        fields: [dossierIssueReports.reporterId],
        references: [userProfiles.id],
        relationName: "issueReportReporter",
    }),
    reporterAssignment: one(dossierAssignments, {
        fields: [dossierIssueReports.reporterAssignmentId],
        references: [dossierAssignments.id],
    }),
    escalatedTo: one(userProfiles, {
        fields: [dossierIssueReports.escalatedToId],
        references: [userProfiles.id],
        relationName: "issueReportEscalatedTo",
    }),
    resolvedBy: one(userProfiles, {
        fields: [dossierIssueReports.resolvedById],
        references: [userProfiles.id],
        relationName: "issueReportResolvedBy",
    }),
}));
