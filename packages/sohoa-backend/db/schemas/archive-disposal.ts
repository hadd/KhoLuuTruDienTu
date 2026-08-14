import {
    boolean,
    date,
    index,
    jsonb,
    integer,
    primaryKey,
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
    disposalCouncilEvaluationDecisionEnum,
    disposalAppraisalDocumentTypeEnum,
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
    appraisalSubmittedAt: timestamp("appraisal_submitted_at", { withTimezone: true }),
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
    decisionPublishedAt: timestamp("decision_published_at", { withTimezone: true }),
    decisionDocumentStorageKey: text("decision_document_storage_key"),
    signedMinutesStorageKey: text("signed_minutes_storage_key"),
    bothMinutesExportedAt: timestamp("both_minutes_exported_at", { withTimezone: true }),
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
    excusedAbsent: boolean("excused_absent").notNull().default(false),
    absentReason: text("absent_reason").notNull().default(""),
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
        decision: disposalCouncilEvaluationDecisionEnum("decision"),
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

export const disposalReviewCouncilItemEvaluationHistory = schema.table(
    "disposal_review_council_item_evaluation_history",
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
        oldDecision: disposalCouncilEvaluationDecisionEnum("old_decision"),
        newDecision: disposalCouncilEvaluationDecisionEnum("new_decision").notNull(),
        oldNote: text("old_note"),
        newNote: text("new_note").notNull(),
        changeReason: text("change_reason"),
        changedBy: uuid("changed_by").notNull().references(() => userProfiles.id, {
            onDelete: "restrict",
            onUpdate: "restrict",
        }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("idx_disposal_council_eval_history_council_id").on(table.councilId),
        index("idx_disposal_council_eval_history_item_id").on(table.itemId),
    ],
);

export const disposalReviewCouncilItemOutcomes = schema.table(
    "disposal_review_council_item_outcomes",
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
        destroyVoteCount: integer("destroy_vote_count").notNull().default(0),
        keepVoteCount: integer("keep_vote_count").notNull().default(0),
        participatingMemberCount: integer("participating_member_count").notNull().default(0),
        concludedDecision: disposalCouncilEvaluationDecisionEnum("concluded_decision"),
        hasDissent: boolean("has_dissent").notNull().default(false),
        needsChairDecision: boolean("needs_chair_decision").notNull().default(false),
        chairDecision: disposalCouncilEvaluationDecisionEnum("chair_decision"),
        chairReason: text("chair_reason"),
        chairDecidedBy: uuid("chair_decided_by").references(() => userProfiles.id, {
            onDelete: "restrict",
            onUpdate: "restrict",
        }),
        chairDecidedAt: timestamp("chair_decided_at", { withTimezone: true }),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("disposal_council_item_outcomes_council_item_unique")
            .on(table.councilId, table.itemId),
        index("idx_disposal_council_item_outcomes_council_id").on(table.councilId),
    ],
);

export const disposalAppraisalDocuments = schema.table("disposal_appraisal_documents", {
    catalogId: uuid("catalog_id").notNull().references(() => disposalProposalCatalogs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    documentType: disposalAppraisalDocumentTypeEnum("document_type").notNull(),
    draftStorageKey: text("draft_storage_key"),
    draftExportedAt: timestamp("draft_exported_at", { withTimezone: true }),
    draftExportedBy: uuid("draft_exported_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    signedStorageKey: text("signed_storage_key"),
    signedUploadedAt: timestamp("signed_uploaded_at", { withTimezone: true }),
    signedUploadedBy: uuid("signed_uploaded_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("disposal_appraisal_documents_catalog_type_unique")
        .on(table.catalogId, table.documentType),
    index("idx_disposal_appraisal_documents_catalog_id").on(table.catalogId),
]);

export const disposalCatalogPl3Content = schema.table("disposal_catalog_pl3_content", {
    catalogId: uuid("catalog_id").primaryKey().references(() => disposalProposalCatalogs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    content: jsonb("content").notNull(),
    updatedBy: uuid("updated_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disposalCatalogDocumentDrafts = schema.table("disposal_catalog_document_drafts", {
    catalogId: uuid("catalog_id").notNull().references(() => disposalProposalCatalogs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    documentType: disposalAppraisalDocumentTypeEnum("document_type").notNull(),
    contentJson: jsonb("content_json").notNull(),
    docxStorageKey: text("docx_storage_key"),
    sourceHash: text("source_hash"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.catalogId, table.documentType] }),
    index("idx_disposal_catalog_document_drafts_catalog_id").on(table.catalogId),
]);

export const disposalAppraisalExportRuns = schema.table("disposal_appraisal_export_runs", {
    id: uuid("id").defaultRandom().primaryKey(),
    catalogId: uuid("catalog_id").notNull().references(() => disposalProposalCatalogs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    documentType: disposalAppraisalDocumentTypeEnum("document_type").notNull(),
    runNumber: integer("run_number").notNull(),
    storageKey: text("storage_key").notNull(),
    createdBy: uuid("created_by").notNull().references(() => userProfiles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_disposal_appraisal_export_runs_catalog_id").on(table.catalogId),
]);

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
