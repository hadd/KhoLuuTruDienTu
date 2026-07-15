import { varchar, timestamp, index, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { retentionPeriods } from "./retention-period.ts";

export const documentTypes = schema.table("document_types", {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    retentionPeriodId: text("retention_period_id").references(() => retentionPeriods.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_document_types_name").on(table.name),
    index("idx_document_types_retention_period_id").on(table.retentionPeriodId),
]);

export type DocumentType = typeof documentTypes.$inferSelect;
export type NewDocumentType = typeof documentTypes.$inferInsert;

export const documentTypesRelations = relations(documentTypes, ({ one }) => ({
    retentionPeriod: one(retentionPeriods, {
        fields: [documentTypes.retentionPeriodId],
        references: [retentionPeriods.id],
    }),
}));
