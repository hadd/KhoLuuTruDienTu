import { varchar, timestamp, uuid, index, uniqueIndex, integer, text } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { folders } from "./folder.ts";
import { DossierStatus } from "./workflow-constants.ts";
import { entityTypeEnum, dossierStatusEnum } from "./workflow-enums.ts";

export const dossiers = schema.table("dossiers", {
    id: uuid("id").defaultRandom().primaryKey(),
    folderId: uuid("folder_id").notNull().references(() => folders.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    folderPath: varchar("folder_path", { length: 500 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    entityType: entityTypeEnum("type").notNull(),
    status: dossierStatusEnum("status").notNull().default(DossierStatus.NEW),
    rejectCount: integer("reject_count").notNull().default(0),
    lastRejectNotes: text("last_reject_notes"),
    ocrMetadataKey: text("ocr_metadata_key"),
    currentMetadataKey: text("current_metadata_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_dossiers_path").on(table.folderPath),
    index("idx_dossiers_status_folder").on(table.status, table.folderId),
    uniqueIndex("dossiers_folder_path_name_unique").on(table.folderPath, table.name),
]);

export type Dossier = typeof dossiers.$inferSelect;
export type NewDossier = typeof dossiers.$inferInsert;
