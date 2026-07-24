import {
    integer,
    jsonb,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { fonds } from "./fond.ts";
import { dossiers } from "./dossier.ts";
import type { DocumentNamingSegment } from "../../libs/document-naming-types.ts";

export const documentNamingConfigs = schema.table("document_naming_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    fondId: text("fond_id").notNull().references(() => fonds.id),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    dossierId: uuid("dossier_id").references(() => dossiers.id),
    segments: jsonb("segments").$type<DocumentNamingSegment[]>().notNull().default([]),
    autoIncrementCounter: integer("auto_increment_counter").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("uq_document_naming_configs_fond_dossier")
        .on(table.fondId)
        .where(sql`${table.targetType} = 'dossier' AND ${table.deletedAt} IS NULL`),
    uniqueIndex("uq_document_naming_configs_fond_file")
        .on(table.fondId, table.dossierId)
        .where(sql`${table.targetType} = 'file' AND ${table.deletedAt} IS NULL`),
]);

export type DocumentNamingConfig = typeof documentNamingConfigs.$inferSelect;
export type NewDocumentNamingConfig = typeof documentNamingConfigs.$inferInsert;
