import { relations } from "drizzle-orm";
import { boolean, integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

export const emailSenderConfigs = schema.table("email_sender_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    smtpHost: varchar("smtp_host", { length: 255 }),
    smtpPort: integer("smtp_port").notNull().default(587),
    smtpSecure: boolean("smtp_secure").notNull().default(false),
    smtpUser: varchar("smtp_user", { length: 255 }),
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    fromName: varchar("from_name", { length: 255 }),
    replyTo: varchar("reply_to", { length: 255 }),
    smtpPasswordEncrypted: text("smtp_password_encrypted").notNull(),
    updatedById: uuid("updated_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailSenderConfig = typeof emailSenderConfigs.$inferSelect;
export type NewEmailSenderConfig = typeof emailSenderConfigs.$inferInsert;

export const emailSenderConfigsRelations = relations(emailSenderConfigs, ({ one }) => ({
    updatedBy: one(userProfiles, {
        fields: [emailSenderConfigs.updatedById],
        references: [userProfiles.id],
    }),
}));
