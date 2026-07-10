import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { getEmailConfigStatus } from "../../libs/email-config.ts";
import {
    NotificationChannel,
    NotificationType,
    NOTIFICATION_CHANNEL_VALUES,
    NOTIFICATION_TYPE_VALUES,
    type NotificationChannelValue,
    type NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import { roles } from "../../db/schemas/role.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";
import { AuthRole } from "../auth/auth-helper.ts";
import type {
    DossierAssignedNotificationContext,
    OcrCompletedNotificationContext,
} from "./types.ts";

export function buildNotificationDedupeKey(
    notificationType: string,
    channels: string[],
    roleIds: string[],
): string {
    const sortedChannels = [...channels].sort().join(",");
    const sortedRoles = [...roleIds].sort().join(",");
    return `${notificationType}|${sortedChannels}|${sortedRoles}`;
}

export function isValidNotificationType(value: string): value is NotificationTypeValue {
    return (NOTIFICATION_TYPE_VALUES as readonly string[]).includes(value);
}

export function isValidNotificationChannel(value: string): value is NotificationChannelValue {
    return (NOTIFICATION_CHANNEL_VALUES as readonly string[]).includes(value);
}

export async function getRoleWarnings(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
        return [];
    }

    const existingRoles = await db.query.roles.findMany({
        where: and(
            inArray(roles.id, roleIds),
            isNull(roles.deletedAt),
        ),
        columns: { id: true, name: true },
    });

    const warnings: string[] = [];
    const existingRoleIds = new Set(existingRoles.map((role) => role.id));

    for (const roleId of roleIds) {
        if (!existingRoleIds.has(roleId)) {
            warnings.push(`Role "${roleId}" does not exist`);
        }
    }

    const activeUsers = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .innerJoin(userProfiles, eq(userRoles.userId, userProfiles.id))
        .where(and(
            inArray(userRoles.roleId, roleIds),
            isNull(userRoles.expiredAt),
            isNull(userProfiles.deletedAt),
            eq(userProfiles.active, true),
        ));

    const roleUserCounts = new Map<string, number>();
    for (const row of activeUsers) {
        roleUserCounts.set(row.roleId, (roleUserCounts.get(row.roleId) ?? 0) + 1);
    }

    for (const role of existingRoles) {
        if ((roleUserCounts.get(role.id) ?? 0) === 0) {
            warnings.push(`Role "${role.name}" has no active users`);
        }
    }

    return warnings;
}

export async function getEmailChannelWarnings(
    channels: NotificationChannelValue[],
): Promise<string[]> {
    if (!channels.includes(NotificationChannel.EMAIL)) {
        return [];
    }

    const status = await getEmailConfigStatus();
    if (status.configured) {
        return [];
    }

    return [
        `Email channel selected but sender is not configured: missing ${status.missingFields.join(", ")}`,
    ];
}

export async function getActiveUserRoleMap(userIds: string[]): Promise<Map<string, Set<string>>> {
    if (userIds.length === 0) {
        return new Map();
    }

    const rows = await db
        .select({
            userId: userRoles.userId,
            roleId: userRoles.roleId,
        })
        .from(userRoles)
        .innerJoin(userProfiles, eq(userRoles.userId, userProfiles.id))
        .where(and(
            inArray(userRoles.userId, userIds),
            isNull(userRoles.expiredAt),
            isNull(userProfiles.deletedAt),
            eq(userProfiles.active, true),
        ));

    const result = new Map<string, Set<string>>();
    for (const row of rows) {
        const rolesForUser = result.get(row.userId) ?? new Set<string>();
        rolesForUser.add(row.roleId);
        result.set(row.userId, rolesForUser);
    }
    return result;
}

export async function getActiveUsersByRoleIds(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
        return [];
    }

    const rows = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(userProfiles, eq(userRoles.userId, userProfiles.id))
        .where(and(
            inArray(userRoles.roleId, roleIds),
            isNull(userRoles.expiredAt),
            isNull(userProfiles.deletedAt),
            eq(userProfiles.active, true),
        ));

    return [...new Set(rows.map((row) => row.userId))];
}

function intersectRecipientsWithRoles(
    candidateUserIds: string[],
    configuredRoleIds: string[],
    userRoleMap: Map<string, Set<string>>,
): string[] {
    const configuredRoles = new Set(configuredRoleIds);
    return candidateUserIds.filter((userId) => {
        const userRolesSet = userRoleMap.get(userId);
        if (!userRolesSet) {
            return false;
        }
        for (const roleId of userRolesSet) {
            if (configuredRoles.has(roleId)) {
                return true;
            }
        }
        return false;
    });
}

export async function resolveOcrCompletedRecipients(
    configuredRoleIds: string[],
): Promise<string[]> {
    const defaultRoleIds = [AuthRole.ADMIN, AuthRole.PROJECT_MANAGER];
    const lookupRoleIds = configuredRoleIds.length > 0
        ? configuredRoleIds
        : defaultRoleIds;

    const candidates = await getActiveUsersByRoleIds(lookupRoleIds);
    const userRoleMap = await getActiveUserRoleMap(candidates);
    return intersectRecipientsWithRoles(candidates, configuredRoleIds, userRoleMap);
}

export async function resolveDossierAssignedRecipients(
    context: DossierAssignedNotificationContext,
    configuredRoleIds: string[],
): Promise<string[]> {
    const candidates = [context.assigneeId];
    const userRoleMap = await getActiveUserRoleMap(candidates);
    return intersectRecipientsWithRoles(candidates, configuredRoleIds, userRoleMap);
}

export function buildOcrCompletedContent(context: OcrCompletedNotificationContext) {
    return {
        title: "Hồ sơ OCR hoàn tất",
        body: `Hồ sơ "${context.dossierName}" đã hoàn tất OCR và sẵn sàng nhập liệu.`,
        actionUrl: `/admin/dossiers/${context.dossierId}`,
        entityType: "dossier",
        entityId: context.dossierId,
        payload: {
            dossierId: context.dossierId,
            folderId: context.folderId,
            folderPath: context.folderPath,
        },
    };
}

export function buildDossierAssignedContent(context: DossierAssignedNotificationContext) {
    const isChecker = context.workerRole.startsWith("CHECKER");
    const actionUrl = isChecker
        ? `/data-entry/checker/${context.dossierId}`
        : `/data-entry/maker/${context.dossierId}`;

    const roleLabel = context.workerRole === WorkerRole.MAKER
        ? "biên tập"
        : "duyệt";

    return {
        title: "Phân công hồ sơ mới",
        body: `Bạn được phân công hồ sơ "${context.dossierName}" cho vai trò ${roleLabel}.`,
        actionUrl,
        entityType: "dossier",
        entityId: context.dossierId,
        payload: {
            dossierId: context.dossierId,
            folderId: context.folderId,
            workerRole: context.workerRole,
            assigneeId: context.assigneeId,
        },
    };
}

export type ResolvedNotificationContent = {
    title: string;
    body: string;
    actionUrl: string;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
};

export async function resolveNotificationContent(
    type: NotificationTypeValue,
    context: OcrCompletedNotificationContext | DossierAssignedNotificationContext,
): Promise<ResolvedNotificationContent> {
    if (type === NotificationType.OCR_COMPLETED) {
        return buildOcrCompletedContent(context as OcrCompletedNotificationContext);
    }
    return buildDossierAssignedContent(context as DossierAssignedNotificationContext);
}

export async function resolveRecipientsForConfig(
    type: NotificationTypeValue,
    configuredRoleIds: string[],
    context: OcrCompletedNotificationContext | DossierAssignedNotificationContext,
): Promise<string[]> {
    if (type === NotificationType.OCR_COMPLETED) {
        return await resolveOcrCompletedRecipients(configuredRoleIds);
    }
    return await resolveDossierAssignedRecipients(
        context as DossierAssignedNotificationContext,
        configuredRoleIds,
    );
}
