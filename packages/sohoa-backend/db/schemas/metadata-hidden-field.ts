import { boolean, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const metadataHiddenFields = schema.table(
    "metadata_hidden_fields",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        fieldCode: varchar("field_code", { length: 100 }).notNull(),
        groupCode: varchar("group_code", { length: 100 }),
        description: varchar("description", { length: 255 }),
        isHidden: boolean("is_hidden").notNull().default(true),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("uq_metadata_hidden_fields_code").on(table.fieldCode, table.groupCode),
    ]
);

export type MetadataHiddenField = typeof metadataHiddenFields.$inferSelect;
export type NewMetadataHiddenField = typeof metadataHiddenFields.$inferInsert;
