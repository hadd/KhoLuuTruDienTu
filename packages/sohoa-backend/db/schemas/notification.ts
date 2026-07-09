import { boolean, index, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";
import { roles } from "./role.ts";
import { NOTIFICATION_DELIVERY_STATUS_VALUES } from "./notification-constants.ts";

export const notificationConfigs = schema.table("notification_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationType: varchar("notification_type", { length: 50 }).notNull(),
    active: boolean("active").notNull().default(true),
    dedupeKey: text("dedupe_key").notNull(),
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("notification_configs_type_active_idx")
        .on(table.notificationType, table.active)
        .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("notification_configs_dedupe_active_unique")
        .on(table.dedupeKey)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export const notificationConfigChannels = schema.table("notification_config_channels", {
    id: uuid("id").defaultRandom().primaryKey(),
    configId: uuid("config_id").notNull().references(() => notificationConfigs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    channel: varchar("channel", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("notification_config_channels_unique")
        .on(table.configId, table.channel),
    index("notification_config_channels_channel_idx").on(table.channel),
]);

export const notificationConfigRoles = schema.table("notification_config_roles", {
    id: uuid("id").defaultRandom().primaryKey(),
    configId: uuid("config_id").notNull().references(() => notificationConfigs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    roleId: text("role_id").notNull().references(() => roles.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("notification_config_roles_unique")
        .on(table.configId, table.roleId),
    index("notification_config_roles_role_idx").on(table.roleId),
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
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    actionUrl: text("action_url").notNull(),
    payload: jsonb("payload"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("notifications_recipient_unread_idx")
        .on(table.recipientId, table.readAt, table.createdAt),
    index("notifications_recipient_created_idx")
        .on(table.recipientId, table.createdAt),
]);

export const notificationDeliveryStatusEnum = schema.enum(
    "notification_delivery_status",
    [...NOTIFICATION_DELIVERY_STATUS_VALUES],
);

export const notificationDeliveries = schema.table("notification_deliveries", {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    channel: varchar("channel", { length: 50 }).notNull(),
    status: notificationDeliveryStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("notification_deliveries_channel_status_idx")
        .on(table.channel, table.status, table.createdAt),
]);

export type NotificationConfig = typeof notificationConfigs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;

export const notificationConfigsRelations = relations(notificationConfigs, ({ one, many }) => ({
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
    channels: many(notificationConfigChannels),
    roles: many(notificationConfigRoles),
}));

export const notificationConfigChannelsRelations = relations(notificationConfigChannels, ({ one }) => ({
    config: one(notificationConfigs, {
        fields: [notificationConfigChannels.configId],
        references: [notificationConfigs.id],
    }),
}));

export const notificationConfigRolesRelations = relations(notificationConfigRoles, ({ one }) => ({
    config: one(notificationConfigs, {
        fields: [notificationConfigRoles.configId],
        references: [notificationConfigs.id],
    }),
    role: one(roles, {
        fields: [notificationConfigRoles.roleId],
        references: [roles.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
    recipient: one(userProfiles, {
        fields: [notifications.recipientId],
        references: [userProfiles.id],
    }),
    deliveries: many(notificationDeliveries),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
    notification: one(notifications, {
        fields: [notificationDeliveries.notificationId],
        references: [notifications.id],
    }),
}));
