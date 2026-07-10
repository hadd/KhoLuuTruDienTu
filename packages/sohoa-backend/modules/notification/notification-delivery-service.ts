import { httpError } from "@shared/common-lib";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import {
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationType,
    type NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import {
    notificationDeliveries,
    notifications,
} from "../../db/schemas/notification.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { getEmailConfigStatus } from "../../libs/email-config.ts";
import { sendNotificationEmail } from "../../libs/notification-email.ts";
import { emitUserNotification } from "../../libs/socket-io.ts";
import { NotificationConfigService } from "./notification-config-service.ts";
import {
    resolveNotificationContent,
    resolveRecipientsForConfig,
} from "./notification-resolver.ts";
import type {
    DossierAssignedNotificationContext,
    NotificationInboxRecord,
    OcrCompletedNotificationContext,
} from "./types.ts";

function mapInbox(row: typeof notifications.$inferSelect): NotificationInboxRecord {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        entityType: row.entityType,
        entityId: row.entityId,
        actionUrl: row.actionUrl,
        payload: row.payload,
        readAt: row.readAt,
        createdAt: row.createdAt,
    };
}

async function deliverChannel(
    notification: typeof notifications.$inferSelect,
    channel: string,
    recipientEmail: string | null,
): Promise<void> {
    const [delivery] = await db.insert(notificationDeliveries).values({
        notificationId: notification.id,
        channel,
        status: NotificationDeliveryStatus.PENDING,
    }).returning();

    if (channel === NotificationChannel.SYSTEM) {
        emitUserNotification(notification.recipientId, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            actionUrl: notification.actionUrl,
            entityType: notification.entityType,
            entityId: notification.entityId,
            createdAt: notification.createdAt.toISOString(),
        });

        await db.update(notificationDeliveries)
            .set({
                status: NotificationDeliveryStatus.SENT,
                sentAt: new Date(),
            })
            .where(eq(notificationDeliveries.id, delivery.id));
        return;
    }

    if (channel === NotificationChannel.EMAIL) {
        try {
            if (!recipientEmail) {
                throw new Error("Recipient has no email address");
            }

            const emailStatus = await getEmailConfigStatus();
            if (!emailStatus.configured) {
                throw new Error(
                    `Email not configured: missing ${emailStatus.missingFields.join(", ")}`,
                );
            }

            await sendNotificationEmail({
                to: recipientEmail,
                subject: notification.title,
                text: `${notification.body}\n\n${notification.actionUrl}`,
            });

            await db.update(notificationDeliveries)
                .set({
                    status: NotificationDeliveryStatus.SENT,
                    sentAt: new Date(),
                })
                .where(eq(notificationDeliveries.id, delivery.id));
        } catch (error) {
            await db.update(notificationDeliveries)
                .set({
                    status: NotificationDeliveryStatus.FAILED,
                    error: error instanceof Error ? error.message : String(error),
                })
                .where(eq(notificationDeliveries.id, delivery.id));
        }
    }
}

async function dispatchForType(
    type: NotificationTypeValue,
    context: OcrCompletedNotificationContext | DossierAssignedNotificationContext,
): Promise<void> {
    const configs = await NotificationConfigService.listActiveByType(type);
    if (configs.length === 0) {
        return;
    }

    const content = await resolveNotificationContent(type, context);
    const notifiedRecipients = new Set<string>();

    const recipientEmails = new Map<string, string | null>();
    async function getRecipientEmail(userId: string): Promise<string | null> {
        if (recipientEmails.has(userId)) {
            return recipientEmails.get(userId) ?? null;
        }
        const profile = await db.query.userProfiles.findFirst({
            where: and(
                eq(userProfiles.id, userId),
                isNull(userProfiles.deletedAt),
                eq(userProfiles.active, true),
            ),
            columns: { email: true },
        });
        const email = profile?.email ?? null;
        recipientEmails.set(userId, email);
        return email;
    }

    for (const config of configs) {
        const roleIds = config.roles.map((role) => role.roleId);
        const channels = config.channels.map((item) => item.channel);
        const recipients = await resolveRecipientsForConfig(type, roleIds, context);

        for (const recipientId of recipients) {
            if (notifiedRecipients.has(recipientId)) {
                continue;
            }
            notifiedRecipients.add(recipientId);

            const [notification] = await db.insert(notifications).values({
                recipientId,
                type,
                title: content.title,
                body: content.body,
                entityType: content.entityType,
                entityId: content.entityId,
                actionUrl: content.actionUrl,
                payload: content.payload,
            }).returning();

            const email = await getRecipientEmail(recipientId);
            for (const channel of channels) {
                await deliverChannel(notification, channel, email);
            }
        }
    }
}

export const NotificationDeliveryService = {
    async dispatchOcrCompleted(context: OcrCompletedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.OCR_COMPLETED, context);
    },

    async dispatchDossierAssigned(context: DossierAssignedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.DOSSIER_ASSIGNED, context);
    },
};

export function scheduleOcrCompletedNotification(context: OcrCompletedNotificationContext): void {
    NotificationDeliveryService.dispatchOcrCompleted(context).catch((error) => {
        console.error("[Notification] OCR_COMPLETED dispatch failed:", error);
    });
}

export function scheduleDossierAssignedNotification(
    context: DossierAssignedNotificationContext,
): void {
    NotificationDeliveryService.dispatchDossierAssigned(context).catch((error) => {
        console.error("[Notification] DOSSIER_ASSIGNED dispatch failed:", error);
    });
}

export const NotificationInboxService = {
    async list(recipientId: string, input: { unreadOnly?: boolean; limit?: number; offset?: number }) {
        const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
        const offset = Math.max(input.offset ?? 0, 0);

        const rows = await db.query.notifications.findMany({
            where: and(
                eq(notifications.recipientId, recipientId),
                input.unreadOnly ? isNull(notifications.readAt) : undefined,
            ),
            orderBy: desc(notifications.createdAt),
            limit,
            offset,
        });

        return rows.map(mapInbox);
    },

    async unreadCount(recipientId: string) {
        const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(
                eq(notifications.recipientId, recipientId),
                isNull(notifications.readAt),
            ));

        return { count: row?.count ?? 0 };
    },

    async markRead(recipientId: string, notificationId: string) {
        const [row] = await db.update(notifications)
            .set({ readAt: new Date() })
            .where(and(
                eq(notifications.id, notificationId),
                eq(notifications.recipientId, recipientId),
                isNull(notifications.readAt),
            ))
            .returning();

        if (!row) {
            const existing = await db.query.notifications.findFirst({
                where: and(
                    eq(notifications.id, notificationId),
                    eq(notifications.recipientId, recipientId),
                ),
            });
            if (!existing) {
                throw httpError.notFound("Notification not found");
            }
            return mapInbox(existing);
        }

        return mapInbox(row);
    },

    async markAllRead(recipientId: string) {
        const updated = await db.update(notifications)
            .set({ readAt: new Date() })
            .where(and(
                eq(notifications.recipientId, recipientId),
                isNull(notifications.readAt),
            ))
            .returning({ id: notifications.id });

        return { updatedCount: updated.length };
    },
};
