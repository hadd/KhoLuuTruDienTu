import { httpError } from "@shared/common-lib";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import {
    archivePermissionConfigs,
} from "../../db/schemas/archive-permission-config.ts";
import {
    archivePermissionSlots,
} from "../../db/schemas/archive-permission-slot.ts";

function mapConfig(row: {
    id: string;
    name: string;
    description: string | null;
    status: "draft" | "ready" | "close";
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function mapSlot(row: {
    id: string;
    configId: string;
    slotCode: string;
    slotName: string;
    sortOrder: number;
    permissionKeys: string[];
    fondIds: string[];
}) {
    return {
        id: row.id,
        configId: row.configId,
        slotCode: row.slotCode,
        slotName: row.slotName,
        sortOrder: row.sortOrder,
        permissionKeys: row.permissionKeys,
        fondIds: row.fondIds,
    };
}

async function getConfigOrThrow(id: string) {
    const row = await db.query.archivePermissionConfigs.findFirst({
        where: and(
            eq(archivePermissionConfigs.id, id),
            isNull(archivePermissionConfigs.deletedAt),
        ),
        with: {
            slots: {
                orderBy: (slots, { asc }) => [asc(slots.sortOrder)],
            },
        },
    });
    if (!row) {
        throw httpError.notFound("Archive permission config not found");
    }
    return row;
}

export const ArchivePermissionService = {
    async list(status?: "draft" | "ready" | "close") {
        const rows = await db.query.archivePermissionConfigs.findMany({
            where: status
                ? and(
                    eq(archivePermissionConfigs.status, status),
                    isNull(archivePermissionConfigs.deletedAt),
                )
                : isNull(archivePermissionConfigs.deletedAt),
            orderBy: [desc(archivePermissionConfigs.updatedAt)],
            with: {
                slots: {
                    orderBy: (slots, { asc }) => [asc(slots.sortOrder)],
                },
            },
        });

        return {
            items: rows.map((row) => ({
                ...mapConfig(row),
                slots: row.slots.map(mapSlot),
            })),
        };
    },

    async listReadyOptions() {
        const rows = await db.query.archivePermissionConfigs.findMany({
            where: and(
                eq(archivePermissionConfigs.status, "ready"),
                isNull(archivePermissionConfigs.deletedAt),
            ),
            orderBy: [desc(archivePermissionConfigs.updatedAt)],
            columns: { id: true, name: true, description: true },
        });
        return { items: rows };
    },

    async get(id: string) {
        const row = await getConfigOrThrow(id);
        return {
            record: {
                ...mapConfig(row),
                slots: row.slots.map(mapSlot),
            },
        };
    },

    async create(input: { name: string; description?: string | null }) {
        const [row] = await db.insert(archivePermissionConfigs).values({
            name: input.name.trim(),
            description: input.description ?? null,
            status: "draft",
        }).returning();
        return { record: mapConfig(row), status: "created" as const };
    },

    async update(
        id: string,
        input: {
            name?: string;
            description?: string | null;
            status?: "draft" | "ready" | "close";
            slots?: Array<{
                slotCode: string;
                slotName: string;
                sortOrder?: number;
                permissionKeys: string[];
                fondIds?: string[];
            }>;
        },
    ) {
        await getConfigOrThrow(id);

        if (
            input.name !== undefined
            || input.description !== undefined
            || input.status !== undefined
        ) {
            await db.update(archivePermissionConfigs).set({
                ...(input.name !== undefined ? { name: input.name.trim() } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                ...(input.status !== undefined ? { status: input.status } : {}),
                updatedAt: new Date(),
            }).where(eq(archivePermissionConfigs.id, id));
        }

        if (input.slots) {
            await db.delete(archivePermissionSlots).where(
                eq(archivePermissionSlots.configId, id),
            );
            if (input.slots.length > 0) {
                await db.insert(archivePermissionSlots).values(
                    input.slots.map((slot, index) => ({
                        configId: id,
                        slotCode: slot.slotCode,
                        slotName: slot.slotName,
                        sortOrder: slot.sortOrder ?? index,
                        permissionKeys: slot.permissionKeys,
                        fondIds: slot.fondIds ?? [],
                    })),
                );
            }
        }

        return this.get(id);
    },

    async delete(id: string) {
        await getConfigOrThrow(id);
        await db.update(archivePermissionConfigs).set({
            deletedAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(archivePermissionConfigs.id, id));
        return { status: "deleted" as const };
    },
};
