import { httpError } from "@shared/common-lib";
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { env } from "../../env.ts";
import { notificationConfigs } from "../../db/schemas/notification.ts";
import { roles } from "../../db/schemas/role.ts";
import { getEmailConfigStatus, isEmailConfigured } from "../../libs/email-config.ts";
import {
    NotificationChannel,
    type NotificationChannelValue,
    type NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import type { NotificationConfigInput, NotificationConfigRecord } from "./types.ts";
import {
    configsMatch,
    getEmailChannelWarnings,
    getRoleWarnings,
    isValidNotificationChannel,
    isValidNotificationType,
    sortChannels,
    sortRoleIds,
} from "./notification-resolver.ts";

type ConfigRow = typeof notificationConfigs.$inferSelect & {
    createdBy?: { id: string; fullName: string | null; email: string } | null;
    updatedBy?: { id: string; fullName: string | null; email: string } | null;
};

function mapConfig(row: ConfigRow, warnings?: string[]): NotificationConfigRecord {
    return {
        id: row.id,
        notificationType: row.notificationType as NotificationTypeValue,
        channels: row.channels as NotificationChannelValue[],
        roleIds: row.roleIds,
        active: row.active,
        createdById: row.createdById,
        updatedById: row.updatedById,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        ...(warnings?.length ? { warnings } : {}),
    };
}

async function validateRoleIds(roleIds: string[]) {
    const existingRoles = await db.query.roles.findMany({
        where: and(
            inArray(roles.id, roleIds),
            isNull(roles.deletedAt),
        ),
        columns: { id: true },
    });

    const existingRoleIds = new Set(existingRoles.map((role) => role.id));
    const missingRoleIds = roleIds.filter((roleId) => !existingRoleIds.has(roleId));
    if (missingRoleIds.length > 0) {
        throw httpError.badRequest(`Unknown roles: ${missingRoleIds.join(", ")}`);
    }
}

function validateConfigInput(input: NotificationConfigInput) {
    if (!isValidNotificationType(input.notificationType)) {
        throw httpError.badRequest(`Invalid notification type: ${input.notificationType}`);
    }

    const channels = sortChannels([...new Set(input.channels)]);
    if (channels.length === 0) {
        throw httpError.badRequest("At least one channel is required");
    }

    for (const channel of channels) {
        if (!isValidNotificationChannel(channel)) {
            throw httpError.badRequest(`Invalid channel: ${channel}`);
        }
    }

    const roleIds = sortRoleIds([...new Set(input.roleIds)]);
    if (roleIds.length === 0) {
        throw httpError.badRequest("At least one role is required");
    }

    return { channels, roleIds };
}

async function findDuplicate(
    notificationType: string,
    channels: NotificationChannelValue[],
    roleIds: string[],
    excludeId?: string,
) {
    const rows = await db.query.notificationConfigs.findMany({
        where: eq(notificationConfigs.notificationType, notificationType),
    });

    return rows.find((row) =>
        row.id !== excludeId &&
        configsMatch(
            row.channels as NotificationChannelValue[],
            row.roleIds,
            channels,
            roleIds,
        )
    );
}

async function assertEmailChannelReady(channels: NotificationChannelValue[]) {
    if (!channels.includes(NotificationChannel.EMAIL)) {
        return;
    }
    if (!await isEmailConfigured()) {
        const status = await getEmailConfigStatus();
        throw httpError.badRequest(
            `Cannot activate notification config with email channel: missing ${status.missingFields.join(", ")}`,
        );
    }
    if (!env.FRONTEND_URL) {
        throw httpError.badRequest(
            "Cannot activate notification config with email channel: FRONTEND_URL is not configured",
        );
    }
}

async function loadConfigById(id: string): Promise<NotificationConfigRecord> {
    const row = await db.query.notificationConfigs.findFirst({
        where: eq(notificationConfigs.id, id),
        with: {
            createdBy: {
                columns: { id: true, fullName: true, email: true },
            },
            updatedBy: {
                columns: { id: true, fullName: true, email: true },
            },
        },
    });

    if (!row) {
        throw httpError.notFound("Notification config not found");
    }

    return mapConfig(row as ConfigRow);
}

export const NotificationConfigService = {
    async list(input: {
        notificationType?: string;
        channel?: string;
        roleId?: string;
        active?: boolean;
        search?: string;
    } = {}) {
        const rows = await db.query.notificationConfigs.findMany({
            where: and(
                input.notificationType
                    ? eq(notificationConfigs.notificationType, input.notificationType)
                    : undefined,
                input.active !== undefined
                    ? eq(notificationConfigs.active, input.active)
                    : undefined,
                input.search?.trim()
                    ? ilike(notificationConfigs.notificationType, `%${input.search.trim()}%`)
                    : undefined,
            ),
            with: {
                createdBy: {
                    columns: { id: true, fullName: true, email: true },
                },
                updatedBy: {
                    columns: { id: true, fullName: true, email: true },
                },
            },
            orderBy: desc(notificationConfigs.updatedAt),
        });

        let mapped = rows.map((row) => mapConfig(row as ConfigRow));

        if (input.channel) {
            mapped = mapped.filter((row) => row.channels.includes(input.channel as NotificationChannelValue));
        }

        if (input.roleId) {
            mapped = mapped.filter((row) => row.roleIds.includes(input.roleId!));
        }

        return mapped;
    },

    async get(id: string) {
        return await loadConfigById(id);
    },

    async create(input: NotificationConfigInput, actorId: string) {
        const { channels, roleIds } = validateConfigInput(input);
        await validateRoleIds(roleIds);

        if (await findDuplicate(input.notificationType, channels, roleIds)) {
            throw httpError.conflict("A notification config with the same type, channels, and roles already exists");
        }

        const [roleWarnings, emailWarnings] = await Promise.all([
            getRoleWarnings(roleIds),
            getEmailChannelWarnings(channels),
        ]);
        const warnings = [...roleWarnings, ...emailWarnings];
        const active = input.active ?? true;
        if (active) {
            await assertEmailChannelReady(channels);
        }

        const [created] = await db.insert(notificationConfigs).values({
            notificationType: input.notificationType,
            channels,
            roleIds,
            active,
            createdById: actorId,
            updatedById: actorId,
        }).returning();

        const record = await loadConfigById(created.id);
        return { ...record, warnings };
    },

    async update(id: string, input: NotificationConfigInput, actorId: string) {
        const existing = await db.query.notificationConfigs.findFirst({
            where: eq(notificationConfigs.id, id),
            columns: { id: true },
        });

        if (!existing) {
            throw httpError.notFound("Notification config not found");
        }

        const { channels, roleIds } = validateConfigInput(input);
        await validateRoleIds(roleIds);

        if (await findDuplicate(input.notificationType, channels, roleIds, id)) {
            throw httpError.conflict("A notification config with the same type, channels, and roles already exists");
        }

        const [roleWarnings, emailWarnings] = await Promise.all([
            getRoleWarnings(roleIds),
            getEmailChannelWarnings(channels),
        ]);
        const warnings = [...roleWarnings, ...emailWarnings];
        const active = input.active ?? true;
        if (active) {
            await assertEmailChannelReady(channels);
        }

        await db.update(notificationConfigs)
            .set({
                notificationType: input.notificationType,
                channels,
                roleIds,
                active,
                updatedById: actorId,
                updatedAt: new Date(),
            })
            .where(eq(notificationConfigs.id, id));

        const record = await loadConfigById(id);
        return { ...record, warnings };
    },

    async setActive(id: string, active: boolean, actorId: string) {
        if (active) {
            const config = await loadConfigById(id);
            await assertEmailChannelReady(config.channels);
        }

        const [row] = await db.update(notificationConfigs)
            .set({
                active,
                updatedById: actorId,
                updatedAt: new Date(),
            })
            .where(eq(notificationConfigs.id, id))
            .returning({ id: notificationConfigs.id });

        if (!row) {
            throw httpError.notFound("Notification config not found");
        }

        return await loadConfigById(id);
    },

    async remove(id: string) {
        const [row] = await db.delete(notificationConfigs)
            .where(eq(notificationConfigs.id, id))
            .returning({ id: notificationConfigs.id });

        if (!row) {
            throw httpError.notFound("Notification config not found");
        }

        return { success: true };
    },

    async listActiveByType(notificationType: NotificationTypeValue) {
        return await db.query.notificationConfigs.findMany({
            where: and(
                eq(notificationConfigs.notificationType, notificationType),
                eq(notificationConfigs.active, true),
            ),
        });
    },
};
