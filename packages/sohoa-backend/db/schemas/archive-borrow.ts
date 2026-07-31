import {
    boolean,
    index,
    integer,
    jsonb,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { dossierFiles } from "./dossier-file.ts";
import { dossierPhysicalPlacements } from "./dossier-physical-placement.ts";
import { physicalWarehouseItems } from "./physical-warehouse-item.ts";
import { userProfiles } from "./user_profile.ts";
import {
    archiveBorrowDipLayoutEnum,
    archiveBorrowDipStatusEnum,
    archiveBorrowItemKindEnum,
    archiveBorrowMediumEnum,
    archiveBorrowStatusEnum,
} from "./archive-borrow-enums.ts";
import type { ArchiveBorrowDipLayoutType } from "./archive-borrow-constants.ts";

export type ArchiveBorrowDipManifestEntry = {
    fileId: string;
    dossierId: string;
    objectKey: string;
    fileName: string;
};

export type ArchiveBorrowDipManifest = Array<ArchiveBorrowDipManifestEntry>;

export const archiveBorrowRequests = schema.table("archive_borrow_requests", {
    id: uuid("id").defaultRandom().primaryKey(),
    medium: archiveBorrowMediumEnum("medium").notNull(),
    requesterId: uuid("requester_id").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    reason: text("reason").notNull().default(""),
    status: archiveBorrowStatusEnum("status").notNull(),
    requestedFrom: timestamp("requested_from", { withTimezone: true }),
    requestedUntil: timestamp("requested_until", { withTimezone: true }),
    approvedFrom: timestamp("approved_from", { withTimezone: true }),
    approvedUntil: timestamp("approved_until", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedBy: uuid("activated_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveredBy: uuid("delivered_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    returnedBy: uuid("returned_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    deliveryNotes: text("delivery_notes"),
    returnNotes: text("return_notes"),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_archive_borrow_requests_medium_status_created").on(
        table.medium,
        table.status,
        table.createdAt,
    ),
    index("idx_archive_borrow_requests_requester_created").on(
        table.requesterId,
        table.createdAt,
    ),
    index("idx_archive_borrow_requests_status_approved_until").on(
        table.status,
        table.approvedUntil,
    ),
    index("idx_archive_borrow_requests_medium_status").on(table.medium, table.status),
]);

export const archiveBorrowItems = schema.table("archive_borrow_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => archiveBorrowRequests.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    itemKind: archiveBorrowItemKindEnum("item_kind").notNull(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    fileId: uuid("file_id").references(() => dossierFiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    fileIdsSnapshot: jsonb("file_ids_snapshot").$type<string[] | null>(),
    physicalPlacementId: uuid("physical_placement_id").references(
        () => dossierPhysicalPlacements.id,
        {
            onDelete: "set null",
            onUpdate: "restrict",
        },
    ),
    physicalItemId: uuid("physical_item_id").references(() => physicalWarehouseItems.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_archive_borrow_items_request_id").on(table.requestId),
    index("idx_archive_borrow_items_dossier_id").on(table.dossierId),
    index("idx_archive_borrow_items_file_id").on(table.fileId),
    index("idx_archive_borrow_items_physical_placement_id").on(table.physicalPlacementId),
]);

export const archiveBorrowDipPackages = schema.table("archive_borrow_dip_packages", {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => archiveBorrowRequests.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    status: archiveBorrowDipStatusEnum("status").notNull().default("PENDING"),
    storageKey: text("storage_key"),
    layout: archiveBorrowDipLayoutEnum("layout")
        .$type<ArchiveBorrowDipLayoutType>()
        .notNull()
        .default("UNPACKED"),
    manifest: jsonb("manifest").$type<ArchiveBorrowDipManifest>().notNull().default([]),
    checksum: varchar("checksum", { length: 64 }),
    byteSize: integer("byte_size"),
    hasWatermark: boolean("has_watermark").notNull().default(false),
    isEncrypted: boolean("is_encrypted").notNull().default(false),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("uq_archive_borrow_dip_packages_request_id").on(table.requestId),
    index("idx_archive_borrow_dip_packages_status").on(table.status),
]);

export type ArchiveBorrowRequest = typeof archiveBorrowRequests.$inferSelect;
export type NewArchiveBorrowRequest = typeof archiveBorrowRequests.$inferInsert;
export type ArchiveBorrowItem = typeof archiveBorrowItems.$inferSelect;
export type NewArchiveBorrowItem = typeof archiveBorrowItems.$inferInsert;
export type ArchiveBorrowDipPackage = typeof archiveBorrowDipPackages.$inferSelect;
export type NewArchiveBorrowDipPackage = typeof archiveBorrowDipPackages.$inferInsert;

export const archiveBorrowRequestsRelations = relations(
    archiveBorrowRequests,
    ({ one, many }) => ({
        requester: one(userProfiles, {
            fields: [archiveBorrowRequests.requesterId],
            references: [userProfiles.id],
            relationName: "archiveBorrowRequester",
        }),
        reviewer: one(userProfiles, {
            fields: [archiveBorrowRequests.reviewedBy],
            references: [userProfiles.id],
            relationName: "archiveBorrowReviewer",
        }),
        activator: one(userProfiles, {
            fields: [archiveBorrowRequests.activatedBy],
            references: [userProfiles.id],
            relationName: "archiveBorrowActivator",
        }),
        deliverer: one(userProfiles, {
            fields: [archiveBorrowRequests.deliveredBy],
            references: [userProfiles.id],
            relationName: "archiveBorrowDeliverer",
        }),
        returner: one(userProfiles, {
            fields: [archiveBorrowRequests.returnedBy],
            references: [userProfiles.id],
            relationName: "archiveBorrowReturner",
        }),
        items: many(archiveBorrowItems),
        dipPackage: one(archiveBorrowDipPackages, {
            fields: [archiveBorrowRequests.id],
            references: [archiveBorrowDipPackages.requestId],
        }),
    }),
);

export const archiveBorrowItemsRelations = relations(archiveBorrowItems, ({ one }) => ({
    request: one(archiveBorrowRequests, {
        fields: [archiveBorrowItems.requestId],
        references: [archiveBorrowRequests.id],
    }),
    dossier: one(dossiers, {
        fields: [archiveBorrowItems.dossierId],
        references: [dossiers.id],
    }),
    file: one(dossierFiles, {
        fields: [archiveBorrowItems.fileId],
        references: [dossierFiles.id],
    }),
    physicalPlacement: one(dossierPhysicalPlacements, {
        fields: [archiveBorrowItems.physicalPlacementId],
        references: [dossierPhysicalPlacements.id],
    }),
    physicalItem: one(physicalWarehouseItems, {
        fields: [archiveBorrowItems.physicalItemId],
        references: [physicalWarehouseItems.id],
    }),
}));

export const archiveBorrowDipPackagesRelations = relations(
    archiveBorrowDipPackages,
    ({ one }) => ({
        request: one(archiveBorrowRequests, {
            fields: [archiveBorrowDipPackages.requestId],
            references: [archiveBorrowRequests.id],
        }),
    }),
);
