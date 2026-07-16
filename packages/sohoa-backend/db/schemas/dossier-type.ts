import { varchar, timestamp, index, text, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

export const dossierTypes = schema.table("dossier_types", {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_dossier_types_name").on(table.name),
    index("idx_dossier_types_is_active").on(table.isActive)
        .where(sql`${table.isActive} = true`),
]);

export type DossierType = typeof dossierTypes.$inferSelect;
export type NewDossierType = typeof dossierTypes.$inferInsert;
