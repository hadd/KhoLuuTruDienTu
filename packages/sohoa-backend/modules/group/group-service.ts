import { httpError } from "@shared/common-lib";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { groups } from "../../db/schemas/groups.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { AuthRole } from "../auth/auth-helper.ts";
import { DossierService } from "../dossier/dossier-service.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    updateGroupBodySchema,
} from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function slugify(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}

async function generateGroupId(name: string, preferredId?: string): Promise<string> {
    const base = preferredId?.trim() || slugify(name);
    if (!base) {
        throw httpError.badRequest("Cannot generate group ID from name");
    }

    let candidate = base;
    let suffix = 1;

    while (true) {
        const existing = await db.query.groups.findFirst({
            where: eq(groups.id, candidate),
        });
        if (!existing) {
            return candidate;
        }
        candidate = `${base}-${suffix++}`;
    }
}

async function validateEditorIds(editorIds: string[]) {
    if (editorIds.length === 0) {
        throw httpError.badRequest("At least one editor is required");
    }

    const uniqueIds = [...new Set(editorIds)];
    if (uniqueIds.length !== editorIds.length) {
        throw httpError.badRequest("Duplicate editor IDs");
    }

    const users = await db.query.userProfiles.findMany({
        where: and(
            inArray(userProfiles.id, uniqueIds),
            isNull(userProfiles.deletedAt),
        ),
        with: {
            userRoles: {
                where: isNull(userRoles.expiredAt),
                with: { role: true },
            },
        },
    });

    if (users.length !== uniqueIds.length) {
        throw httpError.badRequest("One or more editors not found");
    }

    for (const user of users) {
        if (!user.active) {
            throw httpError.badRequest(`Editor ${user.email} is inactive`);
        }

        const hasEditorRole = user.userRoles.some(
            (userRole) => userRole.role.id === AuthRole.EDITOR,
        );
        if (!hasEditorRole) {
            throw httpError.badRequest(`User ${user.email} does not have editor role`);
        }
    }

    return users;
}

async function assertEditorsNotInOtherGroups(
    editorIds: string[],
    excludeGroupId?: string,
) {
    if (editorIds.length === 0) {
        return;
    }

    const conditions = [
        inArray(groupMembers.userId, editorIds),
        eq(groupMembers.role, "editor"),
        isNull(groupMembers.expiredAt),
        isNull(groups.deletedAt),
    ];

    if (excludeGroupId) {
        conditions.push(ne(groupMembers.groupId, excludeGroupId));
    }

    const conflicts = await db
        .select({
            userId: groupMembers.userId,
            email: userProfiles.email,
            groupName: groups.name,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .innerJoin(userProfiles, eq(groupMembers.userId, userProfiles.id))
        .where(and(...conditions));

    if (conflicts.length === 0) {
        return;
    }

    const details = conflicts.map((member) =>
        `${member.email} (nhóm "${member.groupName}")`
    ).join(", ");

    throw httpError.conflict(
        `Mỗi biên tập viên chỉ được thuộc một nhóm tại một thời điểm. Đang thuộc nhóm khác: ${details}`,
    );
}

async function getActiveGroupOrThrow(groupId: string) {
    const group = await db.query.groups.findFirst({
        where: and(eq(groups.id, groupId), isNull(groups.deletedAt)),
    });

    if (!group) {
        throw httpError.notFound("Group not found");
    }

    return group;
}

async function getActiveEditorsForGroup(groupId: string) {
    return await db.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.role, "editor"),
            isNull(groupMembers.expiredAt),
        ),
        with: {
            userProfile: true,
        },
        orderBy: (members, { asc }) => [asc(members.createdAt)],
    });
}

function mapGroupWithEditors(
    group: typeof groups.$inferSelect,
    members: Awaited<ReturnType<typeof getActiveEditorsForGroup>>,
) {
    return {
        ...group,
        editors: members.map((member) => ({
            memberId: member.id,
            userId: member.userId,
            email: member.userProfile.email,
            fullName: member.userProfile.fullName,
        })),
    };
}

async function syncGroupEditors(tx: DbTx, groupId: string, editorIds: string[]) {
    const now = new Date();
    const current = await tx.query.groupMembers.findMany({
        where: and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.role, "editor"),
            isNull(groupMembers.expiredAt),
        ),
    });

    const currentIds = new Set(current.map((member) => member.userId));
    const newIds = new Set(editorIds);

    for (const member of current) {
        if (!newIds.has(member.userId)) {
            await tx
                .update(groupMembers)
                .set({ expiredAt: now })
                .where(eq(groupMembers.id, member.id));
        }
    }

    for (const userId of editorIds) {
        if (!currentIds.has(userId)) {
            await tx.insert(groupMembers).values({
                groupId,
                userId,
                role: "editor",
            });
        }
    }
}

export const GroupService = {
    async create(input: Static<typeof createGroupBodySchema>) {
        await validateEditorIds(input.editorIds);
        await assertEditorsNotInOtherGroups(input.editorIds);
        const groupId = await generateGroupId(input.name, input.id);

        const record = await db.transaction(async (tx) => {
            const [group] = await tx
                .insert(groups)
                .values({
                    id: groupId,
                    name: input.name,
                    description: input.description ?? null,
                    roundNumber: input.roundNumber ?? 3,
                })
                .returning();

            await tx.insert(groupMembers).values(
                input.editorIds.map((userId) => ({
                    groupId,
                    userId,
                    role: "editor" as const,
                })),
            );

            return group;
        });

        const members = await getActiveEditorsForGroup(record.id);
        return { record: mapGroupWithEditors(record, members) };
    },

    async list() {
        const items = await db.query.groups.findMany({
            where: isNull(groups.deletedAt),
            orderBy: (table, { asc }) => [asc(table.name)],
            with: {
                groupMembers: {
                    where: and(
                        eq(groupMembers.role, "editor"),
                        isNull(groupMembers.expiredAt),
                    ),
                    with: { userProfile: true },
                },
            },
        });

        return {
            items: items.map((group) =>
                mapGroupWithEditors(
                    group,
                    group.groupMembers as Awaited<ReturnType<typeof getActiveEditorsForGroup>>,
                ),
            ),
        };
    },

    async get(groupId: string) {
        const group = await getActiveGroupOrThrow(groupId);
        const members = await getActiveEditorsForGroup(groupId);
        return { record: mapGroupWithEditors(group, members) };
    },

    async update(groupId: string, input: Static<typeof updateGroupBodySchema>) {
        await getActiveGroupOrThrow(groupId);

        if (input.editorIds) {
            await validateEditorIds(input.editorIds);
            const currentMembers = await getActiveEditorsForGroup(groupId);
            const currentUserIds = new Set(currentMembers.map((member) => member.userId));
            const newEditorIds = input.editorIds.filter((userId) => !currentUserIds.has(userId));
            await assertEditorsNotInOtherGroups(newEditorIds, groupId);
        }

        const record = await db.transaction(async (tx) => {
            const updates: Partial<typeof groups.$inferInsert> = {
                updatedAt: new Date(),
            };

            if (input.name !== undefined) {
                updates.name = input.name;
            }
            if (input.description !== undefined) {
                updates.description = input.description;
            }
            if (input.roundNumber !== undefined) {
                updates.roundNumber = input.roundNumber;
            }

            const [group] = await tx
                .update(groups)
                .set(updates)
                .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
                .returning();

            if (!group) {
                throw httpError.notFound("Group not found");
            }

            if (input.editorIds) {
                await syncGroupEditors(tx, groupId, input.editorIds);
            }

            return group;
        });

        const members = await getActiveEditorsForGroup(groupId);
        return { record: mapGroupWithEditors(record, members) };
    },

    async delete(groupId: string) {
        await getActiveGroupOrThrow(groupId);
        const now = new Date();

        await db.transaction(async (tx) => {
            await tx
                .update(groups)
                .set({ deletedAt: now, updatedAt: now })
                .where(eq(groups.id, groupId));

            await tx
                .update(groupMembers)
                .set({ expiredAt: now })
                .where(and(
                    eq(groupMembers.groupId, groupId),
                    isNull(groupMembers.expiredAt),
                ));
        });

        return { status: "deleted" as const, id: groupId };
    },

    async assignByFolder(
        groupId: string,
        input: Static<typeof assignByFolderToGroupBodySchema>,
        actorId: string,
    ) {
        const group = await getActiveGroupOrThrow(groupId);
        const members = await getActiveEditorsForGroup(groupId);

        if (members.length === 0) {
            throw httpError.badRequest("Group has no active editors");
        }

        return await DossierService.assignByFolderToGroup({
            groupId: group.id,
            groupName: group.name,
            roundNumber: group.roundNumber,
            folderId: input.folderId,
            dossiersPerEditor: input.dossiersPerEditor,
            editorUserIds: members.map((member) => ({
                userId: member.userId,
                fullName: member.userProfile.fullName,
            })),
            actorId,
        });
    },
};
