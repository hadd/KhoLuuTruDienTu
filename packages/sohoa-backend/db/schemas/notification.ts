import { boolean, index, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

export const notificationConfigs = schema.table("notification_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationType: varchar("notification_type", { length: 50 }).notNull(),
    channels: text("channels").array().notNull().default([]),
    roleIds: text("role_ids").array().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdById: uuid("created_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedById: uuid("updated_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("notification_configs_type_active_idx")
        .on(table.notificationType, table.active),
]);

export const notifications = schema.table("notifications", {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id").notNull().references(() => userProfiles.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    type: varchar("type", { length: 50 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("notifications_recipient_unread_idx")
        .on(table.recipientId, table.readAt, table.createdAt),
    index("notifications_recipient_created_idx")
        .on(table.recipientId, table.createdAt),
]);

export type NotificationConfig = typeof notificationConfigs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export const notificationConfigsRelations = relations(notificationConfigs, ({ one }) => ({
    createdBy: one(userProfiles, {
        fields: [notificationConfigs.createdById],
        references: [userProfiles.id],
        relationName: "notificationConfigCreatedBy",
    }),
    updatedBy: one(userProfiles, {
        fields: [notificationConfigs.updatedById],
        references: [userProfiles.id],
        relationName: "notificationConfigUpdatedBy",
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    recipient: one(userProfiles, {
        fields: [notifications.recipientId],
        references: [userProfiles.id],
    }),
}));
