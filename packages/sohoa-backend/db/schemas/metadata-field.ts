import { boolean, index, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const metadataFields = schema.table(
    "metadata_fields",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        metadataExtractModeCode: text("metadata_extract_mode_code").notNull(),
        groupCode: varchar("group_code", { length: 100 }),
        fieldCode: varchar("field_code", { length: 100 }).notNull(),
        description: text("description"),
        isHidden: boolean("is_hidden").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("idx_metadata_fields_field_code").on(table.fieldCode),
        index("idx_metadata_fields_group_code").on(table.groupCode),
    ],
);

export type MetadataField = typeof metadataFields.$inferSelect;
export type NewMetadataField = typeof metadataFields.$inferInsert;
