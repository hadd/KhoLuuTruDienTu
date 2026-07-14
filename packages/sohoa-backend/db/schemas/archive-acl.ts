import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

export const ARCHIVE_ACL_RESOURCE_KINDS = [
    "fond",
    "dossier_type",
    "document_type",
] as const;
export type ArchiveAclResourceKind = (typeof ARCHIVE_ACL_RESOURCE_KINDS)[number];

export const ARCHIVE_ACL_PRINCIPAL_KINDS = ["user", "role"] as const;
export type ArchiveAclPrincipalKind = (typeof ARCHIVE_ACL_PRINCIPAL_KINDS)[number];

export const archiveAclResourceKindEnum = schema.enum(
    "archive_acl_resource_kind",
    ARCHIVE_ACL_RESOURCE_KINDS,
);

export const archiveAclPrincipalKindEnum = schema.enum(
    "archive_acl_principal_kind",
    ARCHIVE_ACL_PRINCIPAL_KINDS,
);

/** One row = one warehouse permission on one resource (fond / dossier type / document type). */
export const archiveAclEntries = schema.table("archive_acl_entries", {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceKind: archiveAclResourceKindEnum("resource_kind").notNull(),
    resourceId: text("resource_id").notNull(),
    permissionKey: text("permission_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("archive_acl_entries_resource_perm_unique")
        .on(table.resourceKind, table.resourceId, table.permissionKey),
    index("idx_archive_acl_entries_resource")
        .on(table.resourceKind, table.resourceId),
    index("idx_archive_acl_entries_permission").on(table.permissionKey),
]);

export type ArchiveAclEntry = typeof archiveAclEntries.$inferSelect;
export type NewArchiveAclEntry = typeof archiveAclEntries.$inferInsert;

export const archiveAclPrincipals = schema.table("archive_acl_principals", {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id").notNull().references(() => archiveAclEntries.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    principalKind: archiveAclPrincipalKindEnum("principal_kind").notNull(),
    principalId: text("principal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("archive_acl_principals_unique")
        .on(table.entryId, table.principalKind, table.principalId),
    index("idx_archive_acl_principals_principal")
        .on(table.principalKind, table.principalId),
    index("idx_archive_acl_principals_entry").on(table.entryId),
]);

export type ArchiveAclPrincipal = typeof archiveAclPrincipals.$inferSelect;
export type NewArchiveAclPrincipal = typeof archiveAclPrincipals.$inferInsert;

export const archiveAclEntriesRelations = relations(archiveAclEntries, ({ many }) => ({
    principals: many(archiveAclPrincipals),
}));

export const archiveAclPrincipalsRelations = relations(archiveAclPrincipals, ({ one }) => ({
    entry: one(archiveAclEntries, {
        fields: [archiveAclPrincipals.entryId],
        references: [archiveAclEntries.id],
    }),
}));
