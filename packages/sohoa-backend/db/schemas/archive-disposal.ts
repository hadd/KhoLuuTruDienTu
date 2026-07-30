import {
    boolean,
    date,
    index,
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
import { userProfiles } from "./user_profile.ts";
import {
    disposalProposalCatalogStatusEnum,
    disposalProposalItemSourceEnum,
    duplicateDetectionRuleKeyEnum,
} from "./archive-disposal-enums.ts";

export const duplicateDetectionRules = schema.table("duplicate_detection_rules", {
    id: uuid("id").defaultRandom().primaryKey(),
    ruleKey: duplicateDetectionRuleKeyEnum("rule_key").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    dossierCodeFieldKey: varchar("dossier_code_field_key", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("duplicate_detection_rules_rule_key_unique").on(table.ruleKey),
]);

export const disposalProposalCatalogs = schema.table("disposal_proposal_catalogs", {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    catalogDate: date("catalog_date", { mode: "date" }).notNull(),
    notes: text("notes").notNull().default(""),
    status: disposalProposalCatalogStatusEnum("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("disposal_proposal_catalogs_code_unique").on(table.code),
    index("idx_disposal_proposal_catalogs_status").on(table.status),
    index("idx_disposal_proposal_catalogs_created_by").on(table.createdBy),
]);

export const disposalProposalItems = schema.table("disposal_proposal_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    catalogId: uuid("catalog_id").notNull().references(() => disposalProposalCatalogs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    fileId: uuid("file_id").references(() => dossierFiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    source: disposalProposalItemSourceEnum("source").notNull(),
    reason: text("reason").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("disposal_proposal_items_catalog_dossier_file_unique")
        .on(table.catalogId, table.dossierId, table.fileId),
    index("idx_disposal_proposal_items_catalog_id").on(table.catalogId),
    index("idx_disposal_proposal_items_dossier_id").on(table.dossierId),
]);

export type DuplicateDetectionRule = typeof duplicateDetectionRules.$inferSelect;
export type DisposalProposalCatalog = typeof disposalProposalCatalogs.$inferSelect;
export type DisposalProposalItem = typeof disposalProposalItems.$inferSelect;

export const disposalProposalCatalogsRelations = relations(
    disposalProposalCatalogs,
    ({ one, many }) => ({
        creator: one(userProfiles, {
            fields: [disposalProposalCatalogs.createdBy],
            references: [userProfiles.id],
        }),
        items: many(disposalProposalItems),
    }),
);

export const disposalProposalItemsRelations = relations(
    disposalProposalItems,
    ({ one }) => ({
        catalog: one(disposalProposalCatalogs, {
            fields: [disposalProposalItems.catalogId],
            references: [disposalProposalCatalogs.id],
        }),
        dossier: one(dossiers, {
            fields: [disposalProposalItems.dossierId],
            references: [dossiers.id],
        }),
        file: one(dossierFiles, {
            fields: [disposalProposalItems.fileId],
            references: [dossierFiles.id],
        }),
    }),
);
