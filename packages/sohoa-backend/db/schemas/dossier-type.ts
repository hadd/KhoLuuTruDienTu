import { varchar, timestamp, index, text } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const dossierTypes = schema.table("dossier_types", {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_dossier_types_name").on(table.name),
]);

export type DossierType = typeof dossierTypes.$inferSelect;
export type NewDossierType = typeof dossierTypes.$inferInsert;
