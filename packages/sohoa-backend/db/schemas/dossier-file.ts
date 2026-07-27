import { varchar, timestamp, uuid, integer, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { digitalSignatures } from "./digital-signature.ts";
import { documentTypes } from "./document-type.ts";
import { userProfiles } from "./user_profile.ts";
import { securityLevels } from "./security-level.ts";

export const dossierFiles = schema.table("files", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(),
    fileSizeKb: integer("file_size_kb"),
    signedFilePath: text("signed_file_path"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    documentTypeId: text("document_type_id").references(() => documentTypes.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    securityLevelId: uuid("security_level_id").references(() => securityLevels.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    /** Chế độ xử lý OCR khi upload: 'auto' chạy ngay, 'manual' chờ kích hoạt thủ công. */
    ocrRunMode: varchar("ocr_run_mode", { length: 16 }).notNull().default("auto"),
    /** Chỉ có ý nghĩa khi ocrRunMode = 'manual': 'pending' đang chờ, 'triggered' đã kích hoạt. */
    ocrTriggerStatus: varchar("ocr_trigger_status", { length: 16 }),
    ocrTriggeredAt: timestamp("ocr_triggered_at", { withTimezone: true }),
    ocrTriggeredBy: uuid("ocr_triggered_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("dossier_files_file_path_unique").on(table.filePath),
    index("idx_files_document_type_id").on(table.documentTypeId),
    index("idx_files_security_level_id").on(table.securityLevelId),
    index("idx_files_ocr_run_mode_trigger_status").on(table.ocrRunMode, table.ocrTriggerStatus),
]);

export type DossierFile = typeof dossierFiles.$inferSelect;
export type NewDossierFile = typeof dossierFiles.$inferInsert;

export const dossierFilesRelations = relations(dossierFiles, ({ one, many }) => ({
    dossier: one(dossiers, {
        fields: [dossierFiles.dossierId],
        references: [dossiers.id],
    }),
    documentType: one(documentTypes, {
        fields: [dossierFiles.documentTypeId],
        references: [documentTypes.id],
    }),
    securityLevel: one(securityLevels, {
        fields: [dossierFiles.securityLevelId],
        references: [securityLevels.id],
    }),
    digitalSignatures: many(digitalSignatures),
}));
