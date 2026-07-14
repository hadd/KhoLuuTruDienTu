import { httpError } from "@shared/common-lib";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import {
    notificationConfigChannels,
    notificationConfigRoles,
    notificationConfigs,
} from "../../db/schemas/notification.ts";
import { roles } from "../../db/schemas/role.ts";
import { getEmailConfigStatus, isEmailConfigured } from "../../libs/email-config.ts";
import {
    NotificationChannel,
    type NotificationChannelValue,
    type NotificationTypeValue,
} from "../../db/schemas/notification-constants.ts";
import type { NotificationConfigInput, NotificationConfigRecord } from "./types.ts";
import {
    buildNotificationDedupeKey,
    getEmailChannelWarnings,
    getRoleWarnings,
    isValidNotificationChannel,
    isValidNotificationType,
} from "./notification-resolver.ts";

type ConfigRow = typeof notificationConfigs.$inferSelect & {
    channels: Array<{ channel: string }>;
    roles: Array<{ roleId: string }>;
    createdBy?: { id: string; fullName: string | null; email: string } | null;
    updatedBy?: { id: string; fullName: string | null; email: string } | null;
};

function mapConfig(row: ConfigRow, warnings?: string[]): NotificationConfigRecord {
    return {
        id: row.id,
        notificationType: row.notificationType as NotificationTypeValue,
        channels: row.channels.map((item) => item.channel as NotificationChannelValue),
        roleIds: row.roles.map((item) => item.roleId),
        active: row.active,
        dedupeKey: row.dedupeKey,
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

    const channels = [...new Set(input.channels)];
    if (channels.length === 0) {
        throw httpError.badRequest("At least one channel is required");
    }

    for (const channel of channels) {
        if (!isValidNotificationChannel(channel)) {
            throw httpError.badRequest(`Invalid channel: ${channel}`);
        }
    }

    const roleIds = [...new Set(input.roleIds)];
    if (roleIds.length === 0) {
        throw httpError.badRequest("At least one role is required");
    }

    return { channels, roleIds };
}

async function findDuplicate(
    dedupeKey: string,
    excludeId?: string,
) {
    const rows = await db.query.notificationConfigs.findMany({
        where: eq(notificationConfigs.dedupeKey, dedupeKey),
        columns: { id: true },
    });

    return rows.find((row) => row.id !== excludeId);
}

async function replaceConfigRelations(
    configId: string,
    channels: NotificationChannelValue[],
    roleIds: string[],
) {
    await db.delete(notificationConfigChannels).where(eq(notificationConfigChannels.configId, configId));
    await db.delete(notificationConfigRoles).where(eq(notificationConfigRoles.configId, configId));

    if (channels.length > 0) {
        await db.insert(notificationConfigChannels).values(
            channels.map((channel) => ({ configId, channel })),
        );
    }

    if (roleIds.length > 0) {
        await db.insert(notificationConfigRoles).values(
            roleIds.map((roleId) => ({ configId, roleId })),
        );
    }
}

async function loadConfigById(id: string): Promise<NotificationConfigRecord> {
    const row = await db.query.notificationConfigs.findFirst({
        where: eq(notificationConfigs.id, id),
        with: {
            channels: true,
            roles: true,
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
                    ? or(
                        ilike(notificationConfigs.notificationType, `%${input.search.trim()}%`),
                        ilike(notificationConfigs.dedupeKey, `%${input.search.trim()}%`),
                    )
                    : undefined,
            ),
            with: {
                channels: true,
                roles: true,
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
        const dedupeKey = buildNotificationDedupeKey(input.notificationType, channels, roleIds);

        if (await findDuplicate(dedupeKey)) {
            throw httpError.conflict("A notification config with the same type, channels, and roles already exists");
        }

        const [roleWarnings, emailWarnings] = await Promise.all([
            getRoleWarnings(roleIds),
            getEmailChannelWarnings(channels),
        ]);
        const warnings = [...roleWarnings, ...emailWarnings];
        const active = input.active ?? true;

        const [created] = await db.insert(notificationConfigs).values({
            notificationType: input.notificationType,
            active,
            dedupeKey,
            createdById: actorId,
            updatedById: actorId,
        }).returning();

        await replaceConfigRelations(created.id, channels, roleIds);
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
        const dedupeKey = buildNotificationDedupeKey(input.notificationType, channels, roleIds);

        if (await findDuplicate(dedupeKey, id)) {
            throw httpError.conflict("A notification config with the same type, channels, and roles already exists");
        }

        const [roleWarnings, emailWarnings] = await Promise.all([
            getRoleWarnings(roleIds),
            getEmailChannelWarnings(channels),
        ]);
        const warnings = [...roleWarnings, ...emailWarnings];

        await db.update(notificationConfigs)
            .set({
                notificationType: input.notificationType,
                active: input.active ?? true,
                dedupeKey,
                updatedById: actorId,
                updatedAt: new Date(),
            })
            .where(eq(notificationConfigs.id, id));

        await replaceConfigRelations(id, channels, roleIds);
        const record = await loadConfigById(id);
        return { ...record, warnings };
    },

    async setActive(id: string, active: boolean, actorId: string) {
        if (active) {
            const config = await loadConfigById(id);
            if (config.channels.includes(NotificationChannel.EMAIL)) {
                if (!await isEmailConfigured()) {
                    const status = await getEmailConfigStatus();
                    throw httpError.badRequest(
                        `Cannot activate notification config with email channel: missing ${status.missingFields.join(", ")}`,
                    );
                }
            }
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
            with: {
                channels: true,
                roles: true,
            },
        });
    },
};
