import { varchar, timestamp, uuid, text, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { dossierFiles } from "./dossier-file.ts";
import { userProfiles } from "./user_profile.ts";

export const digitalSignatures = schema.table("digital_signatures", {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id").notNull().references(() => dossierFiles.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    signedBy: uuid("signed_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    certificateSubject: text("certificate_subject").notNull(),
    certificateThumbprint: varchar("certificate_thumbprint", { length: 128 }).notNull(),
    certificateIssuer: text("certificate_issuer").notNull(),
    certificateValidFrom: timestamp("certificate_valid_from", { withTimezone: true }),
    certificateValidTo: timestamp("certificate_valid_to", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("idx_digital_signatures_file").on(table.fileId),
    index("idx_digital_signatures_signed_by").on(table.signedBy),
]);

export type DigitalSignature = typeof digitalSignatures.$inferSelect;
export type NewDigitalSignature = typeof digitalSignatures.$inferInsert;

export const digitalSignaturesRelations = relations(digitalSignatures, ({ one }) => ({
    file: one(dossierFiles, {
        fields: [digitalSignatures.fileId],
        references: [dossierFiles.id],
    }),
    signer: one(userProfiles, {
        fields: [digitalSignatures.signedBy],
        references: [userProfiles.id],
    }),
}));
