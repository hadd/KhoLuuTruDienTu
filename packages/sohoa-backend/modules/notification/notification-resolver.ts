import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { env } from "../../env.ts";
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
    DossierApprovedNotificationContext,
    DossierAssignedNotificationContext,
    EditorsCompletedNotificationContext,
    NotificationDispatchContext,
    OcrCompletedNotificationContext,
    QcStepCompletedNotificationContext,
    SecurityLevelChangedNotificationContext,
} from "./types.ts";

/** Relative FE path for inbox / socket (no origin). Email prepends FRONTEND_URL. */
export function toAbsoluteFrontendUrl(relativeActionUrl: string): string {
    if (!relativeActionUrl.startsWith("/")) {
        throw new Error("actionUrl must be a relative path starting with /");
    }
    if (!env.FRONTEND_URL) {
        throw new Error("FRONTEND_URL is not configured");
    }
    return `${env.FRONTEND_URL}${relativeActionUrl}`;
}

export function sortChannels(channels: NotificationChannelValue[]): NotificationChannelValue[] {
    return [...channels].sort();
}

export function sortRoleIds(roleIds: string[]): string[] {
    return [...roleIds].sort();
}

export function configsMatch(
    leftChannels: NotificationChannelValue[],
    leftRoleIds: string[],
    rightChannels: NotificationChannelValue[],
    rightRoleIds: string[],
): boolean {
    const aChannels = sortChannels(leftChannels);
    const bChannels = sortChannels(rightChannels);
    const aRoles = sortRoleIds(leftRoleIds);
    const bRoles = sortRoleIds(rightRoleIds);

    return aChannels.length === bChannels.length &&
        aRoles.length === bRoles.length &&
        aChannels.every((channel, index) => channel === bChannels[index]) &&
        aRoles.every((roleId, index) => roleId === bRoles[index]);
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

    const warnings: string[] = [];
    const status = await getEmailConfigStatus();
    if (!status.configured) {
        warnings.push(
            `Email channel selected but sender is not configured: missing ${status.missingFields.join(", ")}`,
        );
    }
    if (!env.FRONTEND_URL) {
        warnings.push(
            "Email channel selected but FRONTEND_URL is not configured (needed for absolute email links)",
        );
    }
    return warnings;
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

async function resolveAssigneeRecipients(
    assigneeId: string,
    configuredRoleIds: string[],
): Promise<string[]> {
    const candidates = [assigneeId];
    const userRoleMap = await getActiveUserRoleMap(candidates);
    return intersectRecipientsWithRoles(candidates, configuredRoleIds, userRoleMap);
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
    return await resolveAssigneeRecipients(context.assigneeId, configuredRoleIds);
}

export async function resolveEditorsCompletedRecipients(
    context: EditorsCompletedNotificationContext,
    configuredRoleIds: string[],
): Promise<string[]> {
    return await resolveAssigneeRecipients(context.assigneeId, configuredRoleIds);
}

export async function resolveQcStepCompletedRecipients(
    context: QcStepCompletedNotificationContext,
    configuredRoleIds: string[],
): Promise<string[]> {
    return await resolveAssigneeRecipients(context.assigneeId, configuredRoleIds);
}

export async function resolveDossierApprovedRecipients(
    context: DossierApprovedNotificationContext,
    configuredRoleIds: string[],
): Promise<string[]> {
    return await resolveAssigneeRecipients(context.managerId, configuredRoleIds);
}

async function resolveActorDisplayName(actorId: string): Promise<string> {
    const profile = await db.query.userProfiles.findFirst({
        where: and(
            eq(userProfiles.id, actorId),
            isNull(userProfiles.deletedAt),
        ),
        columns: { fullName: true, email: true },
    });

    return profile?.fullName?.trim() || profile?.email || "Người dùng";
}

export async function resolveSecurityLevelChangedRecipients(
    context: SecurityLevelChangedNotificationContext,
    configuredRoleIds: string[],
): Promise<string[]> {
    const defaultRoleIds = [AuthRole.ADMIN];
    const lookupRoleIds = configuredRoleIds.length > 0
        ? configuredRoleIds
        : defaultRoleIds;

    const candidates = await getActiveUsersByRoleIds(lookupRoleIds);
    const userRoleMap = await getActiveUserRoleMap(candidates);
    const recipients = intersectRecipientsWithRoles(candidates, configuredRoleIds, userRoleMap);
    return recipients.filter((userId) => userId !== context.actorId);
}

export function buildOcrCompletedContent(context: OcrCompletedNotificationContext) {
    return {
        title: "Hồ sơ OCR hoàn tất",
        body: `Hồ sơ "${context.dossierName}" đã hoàn tất OCR và sẵn sàng nhập liệu.`,
        actionUrl: `/app/data?dossierId=${context.dossierId}`,
    };
}

export function buildDossierAssignedContent(context: DossierAssignedNotificationContext) {
    const isChecker = context.workerRole.startsWith("CHECKER");
    const actionUrl = isChecker
        ? `/app/data?dossierId=${context.dossierId}`
        : `/app/data`;

    const roleLabel = context.workerRole === WorkerRole.MAKER
        ? "biên tập"
        : "duyệt";

    return {
        title: "Phân công hồ sơ mới",
        body: `Bạn được phân công hồ sơ "${context.dossierName}" cho vai trò ${roleLabel}.`,
        actionUrl,
    };
}

export function buildEditorsCompletedContent(context: EditorsCompletedNotificationContext) {
    return {
        title: "Hồ sơ chờ QC kiểm tra",
        body: `Hồ sơ "${context.dossierName}" đã biên tập xong và cần QC kiểm tra.`,
        actionUrl: `/app/data?dossierId=${context.dossierId}`,
    };
}

export function buildQcStepCompletedContent(context: QcStepCompletedNotificationContext) {
    return {
        title: "Hồ sơ chờ QC bước tiếp theo",
        body: `Hồ sơ "${context.dossierName}" đã được QC bước ${context.completedQcStep} duyệt, cần QC bước ${context.nextQcStep} kiểm tra.`,
        actionUrl: `/app/data?dossierId=${context.dossierId}`,
    };
}

export function buildDossierApprovedContent(context: DossierApprovedNotificationContext) {
    return {
        title: "Hồ sơ đã được duyệt",
        body: `Hồ sơ "${context.dossierName}" đã được duyệt và sẵn sàng cho các bước tiếp theo.`,
        actionUrl: `/app/data?dossierId=${context.dossierId}`,
    };
}

export async function buildSecurityLevelChangedContent(
    context: SecurityLevelChangedNotificationContext,
) {
    const actorName = await resolveActorDisplayName(context.actorId);
    const levelName = context.securityLevelName;

    const actionMessages: Record<SecurityLevelChangedNotificationContext["action"], string> = {
        created: `Cấp độ bảo mật "${levelName}" đã được tạo bởi ${actorName}.`,
        updated: `Cấp độ bảo mật "${levelName}" đã được cập nhật bởi ${actorName}.`,
        deleted: `Cấp độ bảo mật "${levelName}" đã được xóa bởi ${actorName}.`,
        status_changed: context.isActive === true
            ? `Cấp độ bảo mật "${levelName}" đã được bật bởi ${actorName}.`
            : `Cấp độ bảo mật "${levelName}" đã được tắt bởi ${actorName}.`,
    };

    const titles: Record<SecurityLevelChangedNotificationContext["action"], string> = {
        created: "Cấp độ bảo mật mới",
        updated: "Cập nhật cấp độ bảo mật",
        deleted: "Xóa cấp độ bảo mật",
        status_changed: "Đổi trạng thái cấp độ bảo mật",
    };

    return {
        title: titles[context.action],
        body: actionMessages[context.action],
        actionUrl: "/app/security-levels",
        entityType: "security_level",
        entityId: context.securityLevelId,
        payload: {
            securityLevelId: context.securityLevelId,
            securityLevelName: context.securityLevelName,
            actorId: context.actorId,
            action: context.action,
            isActive: context.isActive ?? null,
        },
    };
}

export type ResolvedNotificationContent = {
    title: string;
    body: string;
    actionUrl: string;
};

export async function resolveNotificationContent(
    type: NotificationTypeValue,
    context: NotificationDispatchContext,
): Promise<ResolvedNotificationContent> {
    switch (type) {
        case NotificationType.OCR_COMPLETED:
            return buildOcrCompletedContent(context as OcrCompletedNotificationContext);
        case NotificationType.DOSSIER_ASSIGNED:
            return buildDossierAssignedContent(context as DossierAssignedNotificationContext);
        case NotificationType.EDITORS_COMPLETED:
            return buildEditorsCompletedContent(context as EditorsCompletedNotificationContext);
        case NotificationType.QC_STEP_COMPLETED:
            return buildQcStepCompletedContent(context as QcStepCompletedNotificationContext);
        case NotificationType.DOSSIER_APPROVED:
            return buildDossierApprovedContent(context as DossierApprovedNotificationContext);
        case NotificationType.SECURITY_LEVEL_CHANGED:
            return await buildSecurityLevelChangedContent(
                context as SecurityLevelChangedNotificationContext,
            );
    }
}

export async function resolveRecipientsForConfig(
    type: NotificationTypeValue,
    configuredRoleIds: string[],
    context: NotificationDispatchContext,
): Promise<string[]> {
    switch (type) {
        case NotificationType.OCR_COMPLETED:
            return await resolveOcrCompletedRecipients(configuredRoleIds);
        case NotificationType.DOSSIER_ASSIGNED:
            return await resolveDossierAssignedRecipients(
                context as DossierAssignedNotificationContext,
                configuredRoleIds,
            );
        case NotificationType.EDITORS_COMPLETED:
            return await resolveEditorsCompletedRecipients(
                context as EditorsCompletedNotificationContext,
                configuredRoleIds,
            );
        case NotificationType.QC_STEP_COMPLETED:
            return await resolveQcStepCompletedRecipients(
                context as QcStepCompletedNotificationContext,
                configuredRoleIds,
            );
        case NotificationType.DOSSIER_APPROVED:
            return await resolveDossierApprovedRecipients(
                context as DossierApprovedNotificationContext,
                configuredRoleIds,
            );
        case NotificationType.SECURITY_LEVEL_CHANGED:
            return await resolveSecurityLevelChangedRecipients(
                context as SecurityLevelChangedNotificationContext,
                configuredRoleIds,
            );
    }
}
