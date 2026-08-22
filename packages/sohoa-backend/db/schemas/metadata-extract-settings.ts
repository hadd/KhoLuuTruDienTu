import { relations } from "drizzle-orm";
import { timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { t } from "elysia";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

/** System-wide metadata extraction pipeline after OCR merge. */
export const MetadataExtractMode = {
    OLD: "old",
    TT05: "tt05",
    PVEP: "pvep",
    OFF: "off",
} as const;

export type MetadataExtractMode =
    (typeof MetadataExtractMode)[keyof typeof MetadataExtractMode];

export const METADATA_EXTRACT_MODE_VALUES = Object.values(MetadataExtractMode) as [
    MetadataExtractMode,
    ...MetadataExtractMode[],
];

export const metadataExtractModeSchema = t.Union([
    t.Literal(MetadataExtractMode.OLD),
    t.Literal(MetadataExtractMode.TT05),
    t.Literal(MetadataExtractMode.PVEP),
    t.Literal(MetadataExtractMode.OFF),
]);

/** Manual / re-extract API modes (includes all pipelines). */
export const MetadataExtractTriggerMode = {
    OLD: "old",
    TT05: "tt05",
    PVEP: "pvep",
    BOTH: "both",
} as const;

export type MetadataExtractTriggerMode =
    (typeof MetadataExtractTriggerMode)[keyof typeof MetadataExtractTriggerMode];

export const metadataExtractTriggerModeSchema = t.Union([
    t.Literal(MetadataExtractTriggerMode.OLD),
    t.Literal(MetadataExtractTriggerMode.TT05),
    t.Literal(MetadataExtractTriggerMode.PVEP),
    t.Literal(MetadataExtractTriggerMode.BOTH),
]);

/**
 * Singleton settings row: mode applies to every dossier after merge-finished-wait.
 */
export const metadataExtractSettings = schema.table("metadata_extract_settings", {
    id: uuid("id").defaultRandom().primaryKey(),
    mode: varchar("mode", { length: 16 }).notNull().default(MetadataExtractMode.OLD),
    updatedById: uuid("updated_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MetadataExtractSettings = typeof metadataExtractSettings.$inferSelect;
export type NewMetadataExtractSettings = typeof metadataExtractSettings.$inferInsert;

export const metadataExtractSettingsRelations = relations(
    metadataExtractSettings,
    ({ one }) => ({
        updatedBy: one(userProfiles, {
            fields: [metadataExtractSettings.updatedById],
            references: [userProfiles.id],
        }),
    }),
);
