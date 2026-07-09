import { httpError } from "@shared/common-lib";
import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { archiveGroupBindings } from "../../db/schemas/archive-group-binding.ts";
import { archiveUserAssignments } from "../../db/schemas/archive-user-assignment.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { ArchivePermissionService } from "./archive-permission-service.ts";

export const ArchiveAssignmentService = {
    async getUserAssignments(userId: string) {
        const rows = await db.query.archiveUserAssignments.findMany({
            where: eq(archiveUserAssignments.userId, userId),
            with: { config: { columns: { id: true, name: true, status: true } } },
        });
        return {
            items: rows.map((row) => ({
                id: row.id,
                userId: row.userId,
                configId: row.configId,
                configName: row.config?.name ?? null,
                slotCode: row.slotCode,
                fondIds: row.fondIds,
                assignedAt: row.assignedAt,
            })),
        };
    },

    async replaceUserAssignments(
        userId: string,
        assignments: Array<{ configId: string; slotCode: string; fondIds: string[] }>,
        assignedBy: string,
    ) {
        for (const item of assignments) {
            await ArchivePermissionService.get(item.configId);
        }

        await db.delete(archiveUserAssignments).where(
            eq(archiveUserAssignments.userId, userId),
        );

        if (assignments.length > 0) {
            await db.insert(archiveUserAssignments).values(
                assignments.map((item) => ({
                    userId,
                    configId: item.configId,
                    slotCode: item.slotCode,
                    fondIds: item.fondIds,
                    assignedBy,
                })),
            );
        }

        return this.getUserAssignments(userId);
    },

    async getGroupBinding(groupId: string) {
        const row = await db.query.archiveGroupBindings.findFirst({
            where: eq(archiveGroupBindings.groupId, groupId),
            with: { config: { columns: { id: true, name: true, status: true } } },
        });
        return { record: row ?? null };
    },

    async upsertGroupBinding(
        groupId: string,
        input: { configId: string; fondIds?: string[] },
    ) {
        await ArchivePermissionService.get(input.configId);

        const existing = await db.query.archiveGroupBindings.findFirst({
            where: eq(archiveGroupBindings.groupId, groupId),
        });

        if (existing) {
            const [row] = await db.update(archiveGroupBindings).set({
                configId: input.configId,
                fondIds: input.fondIds ?? [],
                updatedAt: new Date(),
            }).where(eq(archiveGroupBindings.id, existing.id)).returning();
            return { record: row, status: "updated" as const };
        }

        const [row] = await db.insert(archiveGroupBindings).values({
            groupId,
            configId: input.configId,
            fondIds: input.fondIds ?? [],
        }).returning();
        return { record: row, status: "created" as const };
    },

    async setMemberArchiveSlot(
        groupId: string,
        memberId: string,
        archivePermissionSlotCode: string | null,
    ) {
        const member = await db.query.groupMembers.findFirst({
            where: eq(groupMembers.id, memberId),
        });
        if (!member || member.groupId !== groupId) {
            throw httpError.notFound("Group member not found");
        }

        const [updated] = await db.update(groupMembers).set({
            archivePermissionSlotCode,
        }).where(eq(groupMembers.id, memberId)).returning();

        return { record: updated, status: "updated" as const };
    },
};
