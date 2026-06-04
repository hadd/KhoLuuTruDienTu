import { varchar, timestamp, uuid, index, uniqueIndex, integer, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { folders } from "./folder.ts";
import { groups } from "./groups.ts";
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
    requiredQcCount: integer("required_qc_count").notNull().default(1), 
    currentQcStep: integer("current_qc_step").notNull().default(0),
    rejectCount: integer("reject_count").notNull().default(0),
    lastRejectNotes: text("last_reject_notes"),
    ocrMetadataKey: text("ocr_metadata_key"),
    currentMetadataKey: text("current_metadata_key"),
    assignedGroupId: text("assigned_group_id").references(() => groups.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_dossiers_path").on(table.folderPath),
    index("idx_dossiers_status_folder").on(table.status, table.folderId),
    index("idx_dossiers_assigned_group").on(table.assignedGroupId)
        .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("dossiers_folder_path_name_unique")
        .on(table.folderPath, table.name)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type Dossier = typeof dossiers.$inferSelect;
export type NewDossier = typeof dossiers.$inferInsert;
