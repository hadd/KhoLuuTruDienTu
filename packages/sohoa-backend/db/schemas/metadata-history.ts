import { varchar, timestamp, uuid, index, uniqueIndex, integer, text, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { userProfiles } from "./user_profile.ts";
import { dossierStatusEnum, workerRoleEnum } from "./workflow-enums.ts";

export const metadataHistory = schema.table("metadata_history", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    actorId: uuid("actor_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    role: workerRoleEnum("role"),
    action: varchar("action", { length: 50 }).notNull(),
    fromStatus: dossierStatusEnum("from_status"),
    toStatus: dossierStatusEnum("to_status"),
    s3Key: text("s3_key").notNull(),
    fieldChanges: jsonb("field_changes"),
    versionNumber: integer("version_number").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_metadata_history_dossier").on(table.dossierId),
    uniqueIndex("metadata_history_dossier_version_unique").on(table.dossierId, table.versionNumber),
]);

export type MetadataHistory = typeof metadataHistory.$inferSelect;
export type NewMetadataHistory = typeof metadataHistory.$inferInsert;

export const metadataHistoryRelations = relations(metadataHistory, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [metadataHistory.dossierId],
        references: [dossiers.id],
    }),
    actor: one(userProfiles, {
        fields: [metadataHistory.actorId],
        references: [userProfiles.id],
    }),
}));
