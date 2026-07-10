import { relations } from "drizzle-orm";
import { text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

export const EMAIL_SENDER_CONFIG_DEFAULT_KEY = "default";

export const emailSenderConfigs = schema.table("email_sender_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 50 }).notNull(),
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
}, (table) => [
    uniqueIndex("email_sender_configs_key_unique").on(table.key),
]);

export type EmailSenderConfig = typeof emailSenderConfigs.$inferSelect;
export type NewEmailSenderConfig = typeof emailSenderConfigs.$inferInsert;

export const emailSenderConfigsRelations = relations(emailSenderConfigs, ({ one }) => ({
    updatedBy: one(userProfiles, {
        fields: [emailSenderConfigs.updatedById],
        references: [userProfiles.id],
    }),
}));
