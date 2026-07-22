import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groups } from "../../db/schemas/groups.ts";
import {
    NotificationChannel,
    NotificationType,
    type NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import { notifications } from "../../db/schemas/notification.ts";
import { projects } from "../../db/schemas/project.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import {
    QC_CHECKER_BY_STEP,
    WORKABLE_ASSIGNMENT_STATUSES,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { getEmailConfigStatus } from "../../libs/email-config.ts";
import { sendNotificationEmail } from "../../libs/notification-email.ts";
import { emitUserNotification } from "../../libs/socket-io.ts";
import { NotificationConfigService } from "./notification-config-service.ts";
import {
    resolveNotificationContent,
    resolveRecipientsForConfig,
    toAbsoluteFrontendUrl,
} from "./notification-resolver.ts";
import type {
    DossierApprovedNotificationContext,
    DossierAssignedNotificationContext,
    EditorsCompletedNotificationContext,
    NotificationDispatchContext,
    NotificationInboxRecord,
    OcrCompletedNotificationContext,
    QcStepCompletedNotificationContext,
} from "./types.ts";

function mapInbox(row: typeof notifications.$inferSelect): NotificationInboxRecord {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        actionUrl: row.actionUrl,
        readAt: row.readAt,
        createdAt: row.createdAt,
    };
}

async function deliverChannel(
    notification: typeof notifications.$inferSelect,
    channel: string,
    recipientEmail: string | null,
): Promise<void> {
    if (channel === NotificationChannel.SYSTEM) {
        emitUserNotification(notification.recipientId, {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            actionUrl: notification.actionUrl,
            createdAt: notification.createdAt.toISOString(),
        });
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

            const absoluteActionUrl = toAbsoluteFrontendUrl(notification.actionUrl);
            await sendNotificationEmail({
                to: recipientEmail,
                subject: notification.title,
                text: `${notification.body}\n\n${absoluteActionUrl}`,
            });
        } catch (error) {
            console.error(
                `[Notification] EMAIL delivery failed for notification ${notification.id}:`,
                error instanceof Error ? error.message : error,
            );
        }
    }
}

async function dispatchForType(
    type: NotificationTypeValue,
    context: NotificationDispatchContext,
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
        const roleIds = config.roleIds;
        const channels = config.channels;
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
                actionUrl: content.actionUrl,
            }).returning();

            const email = await getRecipientEmail(recipientId);
            for (const channel of channels) {
                await deliverChannel(notification, channel, email);
            }
        }
    }
}

async function findWorkableCheckerAssignee(
    dossierId: string,
    workerRole: WorkerRoleType,
): Promise<string | null> {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, workerRole),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { assigneeId: true },
    });
    return assignment?.assigneeId ?? null;
}

async function resolveProjectManagerIdForNotification(
    dossierId: string,
): Promise<string | null> {
    const dossier = await db.query.dossiers.findFirst({
        where: and(
            eq(dossiers.id, dossierId),
            isNull(dossiers.deletedAt),
        ),
        columns: {
            projectCode: true,
            assignedGroupId: true,
        },
    });

    if (!dossier) {
        return null;
    }

    let projectCode = dossier.projectCode;
    if (!projectCode && dossier.assignedGroupId) {
        const group = await db.query.groups.findFirst({
            where: and(
                eq(groups.id, dossier.assignedGroupId),
                isNull(groups.deletedAt),
            ),
            columns: { projectCode: true },
        });
        projectCode = group?.projectCode ?? null;
    }

    if (!projectCode) {
        return null;
    }

    const project = await db.query.projects.findFirst({
        where: and(
            eq(projects.projectCode, projectCode),
            isNull(projects.deletedAt),
        ),
        columns: { managerId: true },
    });

    return project?.managerId ?? null;
}

export type WorkflowDossierNotifyInput = {
    dossierId: string;
    dossierName: string;
    folderId: string;
};

export const NotificationDeliveryService = {
    async dispatchOcrCompleted(context: OcrCompletedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.OCR_COMPLETED, context);
    },

    async dispatchDossierAssigned(context: DossierAssignedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.DOSSIER_ASSIGNED, context);
    },

    async dispatchEditorsCompleted(context: EditorsCompletedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.EDITORS_COMPLETED, context);
    },

    async dispatchQcStepCompleted(context: QcStepCompletedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.QC_STEP_COMPLETED, context);
    },

    async dispatchDossierApproved(context: DossierApprovedNotificationContext): Promise<void> {
        await dispatchForType(NotificationType.DOSSIER_APPROVED, context);
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

export function scheduleEditorsCompletedNotification(input: WorkflowDossierNotifyInput): void {
    (async () => {
        const checkerConfig = QC_CHECKER_BY_STEP.get(1);
        if (!checkerConfig) {
            return;
        }

        const assigneeId = await findWorkableCheckerAssignee(input.dossierId, checkerConfig.role);
        if (!assigneeId) {
            return;
        }

        await NotificationDeliveryService.dispatchEditorsCompleted({
            dossierId: input.dossierId,
            dossierName: input.dossierName,
            folderId: input.folderId,
            assigneeId,
            workerRole: checkerConfig.role,
            qcStep: checkerConfig.step,
        });
    })().catch((error) => {
        console.error("[Notification] EDITORS_COMPLETED dispatch failed:", error);
    });
}

export function scheduleQcStepCompletedNotification(
    input: WorkflowDossierNotifyInput & { completedQcStep: number; nextQcStep: number },
): void {
    (async () => {
        const nextCheckerConfig = QC_CHECKER_BY_STEP.get(input.nextQcStep);
        if (!nextCheckerConfig) {
            return;
        }

        const assigneeId = await findWorkableCheckerAssignee(
            input.dossierId,
            nextCheckerConfig.role,
        );
        if (!assigneeId) {
            return;
        }

        await NotificationDeliveryService.dispatchQcStepCompleted({
            dossierId: input.dossierId,
            dossierName: input.dossierName,
            folderId: input.folderId,
            assigneeId,
            workerRole: nextCheckerConfig.role,
            completedQcStep: input.completedQcStep,
            nextQcStep: input.nextQcStep,
        });
    })().catch((error) => {
        console.error("[Notification] QC_STEP_COMPLETED dispatch failed:", error);
    });
}

export function scheduleDossierApprovedNotification(input: WorkflowDossierNotifyInput): void {
    (async () => {
        const managerId = await resolveProjectManagerIdForNotification(input.dossierId);
        if (!managerId) {
            return;
        }

        await NotificationDeliveryService.dispatchDossierApproved({
            dossierId: input.dossierId,
            dossierName: input.dossierName,
            folderId: input.folderId,
            managerId,
        });
    })().catch((error) => {
        console.error("[Notification] DOSSIER_APPROVED dispatch failed:", error);
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
