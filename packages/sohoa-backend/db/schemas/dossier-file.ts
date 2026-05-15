import { varchar, timestamp, uuid, integer, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";

export const dossierFiles = schema.table("files", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    minioPath: text("minio_path").notNull(),
    fileSizeKb: integer("file_size_kb"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DossierFile = typeof dossierFiles.$inferSelect;
export type NewDossierFile = typeof dossierFiles.$inferInsert;

export const dossierFilesRelations = relations(dossierFiles, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [dossierFiles.dossierId],
        references: [dossiers.id],
    }),
}));
