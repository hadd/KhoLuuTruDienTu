import { varchar, timestamp, index, uniqueIndex, integer, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";


export const fonds = schema.table("fonds", {
    id: text("id").primaryKey(),
    fondName: varchar("fond_name", { length: 255 }).notNull(),
    archiveAgency: varchar("archive_agency", { length: 255 }).notNull(),
    dossierCount: integer("dossier_count").notNull().default(0),
    adminstrativeHistory: text("adminstrative_history").notNull(),
    fondType: varchar("fond_type", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("idx_fonds_name").on(table.fondName),
    index("idx_fonds_type").on(table.fondType),
    index("idx_fonds_archive_agency").on(table.archiveAgency)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type Fond = typeof fonds.$inferSelect;
export type NewFond = typeof fonds.$inferInsert;
