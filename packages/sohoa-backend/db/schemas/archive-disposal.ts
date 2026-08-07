import {
    boolean,
    date,
    index,
    jsonb,
    integer,
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
    disposalCouncilMemberHistoryActionEnum,
    disposalCouncilMemberPositionRoleEnum,
    disposalCouncilMemberRepresentationTypeEnum,
    disposalCouncilReviewResultEnum,
} from "./archive-disposal-enums.ts";
import { DISPOSAL_SETTINGS_SINGLETON_ID } from "./archive-disposal-constants.ts";

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

export const disposalSettings = schema.table("disposal_settings", {
    id: uuid("id").primaryKey().default(DISPOSAL_SETTINGS_SINGLETON_ID),
    councilReviewEnabled: boolean("council_review_enabled").notNull().default(true),
    updatedBy: uuid("updated_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disposalReviewCouncils = schema.table("disposal_review_councils", {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    catalogId: uuid("catalog_id").notNull().references(() => disposalProposalCatalogs.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    copiedFromCouncilId: uuid("copied_from_council_id"),
    reviewStartedAt: timestamp("review_started_at", { withTimezone: true }),
    reviewResult: disposalCouncilReviewResultEnum("review_result"),
    createdBy: uuid("created_by").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("disposal_review_councils_code_unique").on(table.code),
    uniqueIndex("disposal_review_councils_catalog_id_unique").on(table.catalogId),
    index("idx_disposal_review_councils_created_by").on(table.createdBy),
]);

export const disposalReviewCouncilMembers = schema.table("disposal_review_council_members", {
    id: uuid("id").defaultRandom().primaryKey(),
    councilId: uuid("council_id").notNull().references(() => disposalReviewCouncils.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    positionRole: varchar("position_role", { length: 255 }).notNull(),
    representationType: disposalCouncilMemberRepresentationTypeEnum("representation_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("disposal_review_council_members_council_user_unique")
        .on(table.councilId, table.userId),
    index("idx_disposal_review_council_members_council_id").on(table.councilId),
]);

export const disposalReviewCouncilMemberHistory = schema.table(
    "disposal_review_council_member_history",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        councilId: uuid("council_id").notNull().references(() => disposalReviewCouncils.id, {
            onDelete: "cascade",
            onUpdate: "restrict",
        }),
        action: disposalCouncilMemberHistoryActionEnum("action").notNull(),
        reason: text("reason").notNull().default(""),
        changedBy: uuid("changed_by").notNull().references(() => userProfiles.id, {
            onDelete: "restrict",
            onUpdate: "restrict",
        }),
        beforeSnapshot: jsonb("before_snapshot"),
        afterSnapshot: jsonb("after_snapshot"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_disposal_council_member_history_council_id").on(table.councilId),
        index("idx_disposal_council_member_history_created_at").on(table.createdAt),
    ],
);

export const disposalReviewCouncilItemEvaluations = schema.table(
    "disposal_review_council_item_evaluations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        councilId: uuid("council_id").notNull().references(() => disposalReviewCouncils.id, {
            onDelete: "cascade",
            onUpdate: "restrict",
        }),
        itemId: uuid("item_id").notNull().references(() => disposalProposalItems.id, {
            onDelete: "cascade",
            onUpdate: "restrict",
        }),
        userId: uuid("user_id").notNull().references(() => userProfiles.id, {
            onDelete: "restrict",
            onUpdate: "restrict",
        }),
        note: text("note").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("disposal_council_item_evaluations_council_item_user_unique")
            .on(table.councilId, table.itemId, table.userId),
        index("idx_disposal_council_item_evaluations_council_id").on(table.councilId),
        index("idx_disposal_council_item_evaluations_item_id").on(table.itemId),
    ],
);

export type DisposalSettings = typeof disposalSettings.$inferSelect;
export type DisposalReviewCouncil = typeof disposalReviewCouncils.$inferSelect;
export type DisposalReviewCouncilMember = typeof disposalReviewCouncilMembers.$inferSelect;
export type DisposalReviewCouncilMemberHistory =
    typeof disposalReviewCouncilMemberHistory.$inferSelect;
export type DisposalReviewCouncilItemEvaluation =
    typeof disposalReviewCouncilItemEvaluations.$inferSelect;

export const disposalProposalCatalogsRelations = relations(
    disposalProposalCatalogs,
    ({ one, many }) => ({
        creator: one(userProfiles, {
            fields: [disposalProposalCatalogs.createdBy],
            references: [userProfiles.id],
        }),
        items: many(disposalProposalItems),
        council: one(disposalReviewCouncils, {
            fields: [disposalProposalCatalogs.id],
            references: [disposalReviewCouncils.catalogId],
        }),
    }),
);

export const disposalProposalItemsRelations = relations(
    disposalProposalItems,
    ({ one, many }) => ({
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
        councilEvaluations: many(disposalReviewCouncilItemEvaluations),
    }),
);

export const disposalReviewCouncilsRelations = relations(
    disposalReviewCouncils,
    ({ one, many }) => ({
        catalog: one(disposalProposalCatalogs, {
            fields: [disposalReviewCouncils.catalogId],
            references: [disposalProposalCatalogs.id],
        }),
        creator: one(userProfiles, {
            fields: [disposalReviewCouncils.createdBy],
            references: [userProfiles.id],
        }),
        copiedFromCouncil: one(disposalReviewCouncils, {
            fields: [disposalReviewCouncils.copiedFromCouncilId],
            references: [disposalReviewCouncils.id],
            relationName: "copiedFrom",
        }),
        members: many(disposalReviewCouncilMembers),
        history: many(disposalReviewCouncilMemberHistory),
        itemEvaluations: many(disposalReviewCouncilItemEvaluations),
    }),
);

export const disposalReviewCouncilMembersRelations = relations(
    disposalReviewCouncilMembers,
    ({ one }) => ({
        council: one(disposalReviewCouncils, {
            fields: [disposalReviewCouncilMembers.councilId],
            references: [disposalReviewCouncils.id],
        }),
        user: one(userProfiles, {
            fields: [disposalReviewCouncilMembers.userId],
            references: [userProfiles.id],
        }),
    }),
);

export const disposalReviewCouncilMemberHistoryRelations = relations(
    disposalReviewCouncilMemberHistory,
    ({ one }) => ({
        council: one(disposalReviewCouncils, {
            fields: [disposalReviewCouncilMemberHistory.councilId],
            references: [disposalReviewCouncils.id],
        }),
        changedByUser: one(userProfiles, {
            fields: [disposalReviewCouncilMemberHistory.changedBy],
            references: [userProfiles.id],
        }),
    }),
);

export const disposalReviewCouncilItemEvaluationsRelations = relations(
    disposalReviewCouncilItemEvaluations,
    ({ one }) => ({
        council: one(disposalReviewCouncils, {
            fields: [disposalReviewCouncilItemEvaluations.councilId],
            references: [disposalReviewCouncils.id],
        }),
        item: one(disposalProposalItems, {
            fields: [disposalReviewCouncilItemEvaluations.itemId],
            references: [disposalProposalItems.id],
        }),
        user: one(userProfiles, {
            fields: [disposalReviewCouncilItemEvaluations.userId],
            references: [userProfiles.id],
        }),
    }),
);
