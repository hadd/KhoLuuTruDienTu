import { varchar, timestamp, uuid, integer, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { digitalSignatures } from "./digital-signature.ts";
import { documentTypes } from "./document-type.ts";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("dossier_files_file_path_unique").on(table.filePath),
    index("idx_files_document_type_id").on(table.documentTypeId),
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
    digitalSignatures: many(digitalSignatures),
}));
