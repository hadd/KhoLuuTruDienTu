import { integer, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossiers } from "./dossier.ts";
import { userProfiles } from "./user_profile.ts";

/** Singleton license + usage for metadata-extract page quota. */
export const pageQuota = schema.table("page_quota", {
    id: uuid("id").defaultRandom().primaryKey(),
    usedPages: integer("used_pages").notNull().default(0),
    usedPagesHmac: varchar("used_pages_hmac", { length: 128 }),
    /** Display cache only — routing always re-reads pageLimit from verified license. */
    pageLimit: integer("page_limit"),
    licensePayload: text("license_payload"),
    licenseSig: text("license_sig"),
    licenseIssuedAt: timestamp("license_issued_at", { withTimezone: true }),
    licenseId: varchar("license_id", { length: 64 }),
    licenseCustomer: varchar("license_customer", { length: 255 }),
    appliedById: uuid("applied_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pageQuotaCharges = schema.table("page_quota_charges", {
    id: uuid("id").defaultRandom().primaryKey(),
    dossierId: uuid("dossier_id").notNull().references(() => dossiers.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    pages: integer("pages").notNull(),
    chargedAt: timestamp("charged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("page_quota_charges_dossier_id_unique").on(table.dossierId),
]);

export type PageQuota = typeof pageQuota.$inferSelect;
export type NewPageQuota = typeof pageQuota.$inferInsert;
export type PageQuotaCharge = typeof pageQuotaCharges.$inferSelect;
export type NewPageQuotaCharge = typeof pageQuotaCharges.$inferInsert;

export const pageQuotaRelations = relations(pageQuota, ({ one }) => ({
    appliedBy: one(userProfiles, {
        fields: [pageQuota.appliedById],
        references: [userProfiles.id],
    }),
}));

export const pageQuotaChargesRelations = relations(pageQuotaCharges, ({ one }) => ({
    dossier: one(dossiers, {
        fields: [pageQuotaCharges.dossierId],
        references: [dossiers.id],
    }),
}));
