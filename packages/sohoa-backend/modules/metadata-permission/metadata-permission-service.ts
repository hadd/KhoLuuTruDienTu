import { httpError } from "@shared/common-lib";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { groups } from "../../db/schemas/groups.ts";
import { groupMembers } from "../../db/schemas/group_members.ts";
import { metadataPermissionConfigs } from "../../db/schemas/metadata_permission_config.ts";
import { metadataPermissionSlots } from "../../db/schemas/metadata_permission_slot.ts";
import { metadataTemplates } from "../../db/schemas/metadata_template.ts";
import {
    parseFieldCatalog,
    parseFieldKeys,
    serializeFieldKeys,
} from "../../libs/metadata-template.ts";
import {
    buildSlotFieldKeysMap,
    validateGroupSlotAssignments,
    validateSlotCoverage,
    type PermissionSlotInput,
} from "../../libs/metadata-permission.ts";

function mapSlot(row: {
    slotCode: string;
    slotName: string;
    sortOrder: number;
    fieldKeys: string;
}) {
    return {
        slotCode: row.slotCode,
        slotName: row.slotName,
        sortOrder: row.sortOrder,
        fieldKeys: parseFieldKeys(row.fieldKeys),
    };
}

function mapConfig(row: {
    id: string;
    name: string;
    description: string | null;
    templateId: string;
    status: "draft" | "ready" | "close";
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        templateId: row.templateId,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

type ActivePermissionConfig = NonNullable<Awaited<ReturnType<typeof getActiveConfigOrThrow>>>;

type GroupPermissionEditor = {
    userId: string;
    permissionSlotCode: string | null;
    userProfile?: {
        email: string | null;
        fullName: string | null;
    } | null;
};

export function buildGroupPermissionPayload(input: {
    config: ActivePermissionConfig | null | undefined;
    editors: GroupPermissionEditor[];
}) {
    if (!input.config) {
        return { permissionConfig: null, assignments: [] as const };
    }

    const config = input.config;
    const assignments = config.slots.map((slot) => ({
        slotCode: slot.slotCode,
        slotName: slot.slotName,
        fieldKeys: parseFieldKeys(slot.fieldKeys),
        editors: input.editors
            .filter((editor) => editor.permissionSlotCode === slot.slotCode)
            .map((editor) => ({
                editorId: editor.userId,
                fullName: editor.userProfile?.fullName ?? null,
                email: editor.userProfile?.email ?? null,
            })),
    }));

    return {
        permissionConfig: {
            ...mapConfig(config),
            template: {
                id: config.template.id,
                name: config.template.name,
                fieldCatalog: parseFieldCatalog(config.template.fieldCatalog),
            },
            slots: config.slots.map(mapSlot),
        },
        assignments,
    };
}

export function resolveActivePermissionConfig(
    config:
        | ({
            deletedAt: Date | null;
            template: { deletedAt: Date | null } | null;
        } & ActivePermissionConfig)
        | null
        | undefined,
) {
    if (!config || config.deletedAt || !config.template || config.template.deletedAt) {
        return null;
    }
    return config;
}

async function getActiveConfigOrThrow(id: string) {
    const row = await db.query.metadataPermissionConfigs.findFirst({
        where: and(
            eq(metadataPermissionConfigs.id, id),
            isNull(metadataPermissionConfigs.deletedAt),
        ),
        with: {
            template: true,
            slots: { orderBy: (slots, { asc }) => [asc(slots.sortOrder)] },
        },
    });
    if (!row || !row.template || row.template.deletedAt) {
        throw httpError.notFound("Metadata permission config not found");
    }
    return row;
}

async function getActiveTemplateOrThrow(id: string) {
    const row = await db.query.metadataTemplates.findFirst({
        where: and(eq(metadataTemplates.id, id), isNull(metadataTemplates.deletedAt)),
    });
    if (!row) {
        throw httpError.notFound("Metadata template not found");
    }
    return row;
}

function assertSlotCoverageValid(fieldCatalog: string, slots: PermissionSlotInput[]) {
    const coverage = validateSlotCoverage(fieldCatalog, slots);
    if (coverage.valid) {
        return;
    }

    const messages: string[] = [];
    if (coverage.invalidPatterns.length > 0) {
        messages.push(`Invalid patterns: ${coverage.invalidPatterns.join(", ")}`);
    }
    if (coverage.uncoveredKeys.length > 0) {
        messages.push(`Uncovered keys: ${coverage.uncoveredKeys.join(", ")}`);
    }
    if (coverage.overlappingKeys.length > 0) {
        const overlaps = coverage.overlappingKeys.map(
            (o) => `${o.key} (${o.slotCodes.join(", ")})`,
        );
        messages.push(`Overlapping keys: ${overlaps.join("; ")}`);
    }
    throw httpError.badRequest(messages.join(". "));
}

async function replaceConfigSlots(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    configId: string,
    slots: PermissionSlotInput[],
) {
    await tx
        .delete(metadataPermissionSlots)
        .where(eq(metadataPermissionSlots.configId, configId));

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]!;
        await tx.insert(metadataPermissionSlots).values({
            configId,
            slotCode: slot.slotCode,
            slotName: slot.slotName,
            sortOrder: i,
            fieldKeys: serializeFieldKeys(slot.fieldKeys),
        });
    }
}

export const MetadataPermissionService = {
    async listTemplateOptions() {
        const rows = await db.query.metadataTemplates.findMany({
            where: isNull(metadataTemplates.deletedAt),
            columns: { id: true, name: true, updatedAt: true },
            orderBy: [desc(metadataTemplates.updatedAt)],
        });
        return rows;
    },

    async listReadyOptions() {
        const rows = await db.query.metadataPermissionConfigs.findMany({
            where: and(
                eq(metadataPermissionConfigs.status, "ready"),
                isNull(metadataPermissionConfigs.deletedAt),
            ),
            columns: { id: true, name: true, templateId: true },
            orderBy: [desc(metadataPermissionConfigs.updatedAt)],
        });
        return rows;
    },

    async list() {
        const rows = await db.query.metadataPermissionConfigs.findMany({
            where: isNull(metadataPermissionConfigs.deletedAt),
            orderBy: [desc(metadataPermissionConfigs.updatedAt)],
            with: {
                template: { columns: { id: true, name: true } },
                slots: { columns: { id: true } },
            },
        });
        return rows.map((row) => ({
            ...mapConfig(row),
            template: row.template,
            slotCount: row.slots.length,
        }));
    },

    async get(id: string) {
        const row = await getActiveConfigOrThrow(id);
        return {
            ...mapConfig(row),
            template: {
                id: row.template.id,
                name: row.template.name,
                fieldCatalog: parseFieldCatalog(row.template.fieldCatalog),
            },
            slots: row.slots.map(mapSlot),
        };
    },

    async create(input: { name: string; description?: string | null; templateId: string }) {
        await getActiveTemplateOrThrow(input.templateId);

        const [inserted] = await db
            .insert(metadataPermissionConfigs)
            .values({
                name: input.name,
                description: input.description ?? null,
                templateId: input.templateId,
                status: "draft",
            })
            .returning();

        return this.get(inserted!.id);
    },

    async update(id: string, input: { name?: string; description?: string | null }) {
        await getActiveConfigOrThrow(id);
        await db
            .update(metadataPermissionConfigs)
            .set({
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                updatedAt: new Date(),
            })
            .where(eq(metadataPermissionConfigs.id, id));
        return this.get(id);
    },

    async updateStatus(id: string, status: "ready" | "close") {
        const config = await getActiveConfigOrThrow(id);
        
        if (config.status === "draft" && status === "ready") {
            throw httpError.badRequest("Cannot set status to ready directly from draft");
        }

        await db
            .update(metadataPermissionConfigs)
            .set({ status, updatedAt: new Date() })
            .where(eq(metadataPermissionConfigs.id, id));
            
        return this.get(id);
    },

    async setSlots(id: string, slots: PermissionSlotInput[]) {
        const config = await getActiveConfigOrThrow(id);
        const boundGroup = await db.query.groups.findFirst({
            where: and(
                eq(groups.metadataPermissionConfigId, id),
                isNull(groups.deletedAt),
            ),
            columns: { id: true },
        });
        if (boundGroup) {
            throw httpError.conflict("Cannot change slots while config is bound to a group");
        }

        assertSlotCoverageValid(config.template.fieldCatalog, slots);

        await db.transaction(async (tx) => {
            await replaceConfigSlots(tx, id, slots);

            await tx
                .update(metadataPermissionConfigs)
                .set({ status: "ready", updatedAt: new Date() })
                .where(eq(metadataPermissionConfigs.id, id));
        });

        return this.get(id);
    },

    async delete(id: string) {
        await getActiveConfigOrThrow(id);
        const boundGroup = await db.query.groups.findFirst({
            where: and(
                eq(groups.metadataPermissionConfigId, id),
                isNull(groups.deletedAt),
            ),
            columns: { id: true },
        });
        if (boundGroup) {
            throw httpError.conflict("Config is bound to a group");
        }

        await db
            .update(metadataPermissionConfigs)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(metadataPermissionConfigs.id, id));

        return { status: "deleted" as const, id };
    },

    async bindGroupConfig(groupId: string, permissionConfigId: string | null) {
        if (permissionConfigId) {
            const config = await getActiveConfigOrThrow(permissionConfigId);
            if (config.status !== "ready") {
                throw httpError.badRequest("Permission config is not ready");
            }
        }

        await db
            .update(groups)
            .set({
                metadataPermissionConfigId: permissionConfigId,
                updatedAt: new Date(),
            })
            .where(eq(groups.id, groupId));

        if (!permissionConfigId) {
            await db
                .update(groupMembers)
                .set({ permissionSlotCode: null })
                .where(and(
                    eq(groupMembers.groupId, groupId),
                    eq(groupMembers.role, "editor"),
                    isNull(groupMembers.expiredAt),
                ));
        }

        return { groupId, permissionConfigId };
    },

    async getGroupPermission(groupId: string) {
        const group = await db.query.groups.findFirst({
            where: and(eq(groups.id, groupId), isNull(groups.deletedAt)),
        });
        if (!group) {
            throw httpError.notFound("Group not found");
        }
        if (!group.metadataPermissionConfigId) {
            return { groupId, permissionConfig: null, assignments: [] };
        }

        const config = await getActiveConfigOrThrow(group.metadataPermissionConfigId);
        const editors = await db.query.groupMembers.findMany({
            where: and(
                eq(groupMembers.groupId, groupId),
                eq(groupMembers.role, "editor"),
                isNull(groupMembers.expiredAt),
            ),
            with: { userProfile: true },
        });

        return {
            groupId,
            ...buildGroupPermissionPayload({ config, editors }),
        };
    },

    async setGroupPermissionAssignments(
        groupId: string,
        assignments: Array<{ slotCode: string; editorIds: string[] }>,
    ) {
        const group = await db.query.groups.findFirst({
            where: and(eq(groups.id, groupId), isNull(groups.deletedAt)),
        });
        if (!group?.metadataPermissionConfigId) {
            throw httpError.badRequest("Group has no metadata permission config");
        }

        const config = await getActiveConfigOrThrow(group.metadataPermissionConfigId);
        const editors = await db.query.groupMembers.findMany({
            where: and(
                eq(groupMembers.groupId, groupId),
                eq(groupMembers.role, "editor"),
                isNull(groupMembers.expiredAt),
            ),
        });
        const editorIds = new Set(editors.map((e) => e.userId));

        const validation = validateGroupSlotAssignments(config.slots, assignments);
        if (!validation.valid) {
            const messages: string[] = [];
            if (validation.duplicateEditors.length > 0) {
                messages.push(
                    `Editors assigned to multiple slots: ${validation.duplicateEditors.join(", ")}`,
                );
            }
            if (validation.uncoveredSlots.length > 0) {
                messages.push(`Slots without editors: ${validation.uncoveredSlots.join(", ")}`);
            }
            throw httpError.badRequest(messages.join(". "));
        }

        const payloadEditorIds = new Set(assignments.flatMap((a) => a.editorIds));
        for (const editorId of payloadEditorIds) {
            if (!editorIds.has(editorId)) {
                throw httpError.badRequest(`Not an active editor in group: ${editorId}`);
            }
        }
        for (const editor of editors) {
            if (!payloadEditorIds.has(editor.userId)) {
                throw httpError.badRequest(
                    `Every active editor must be assigned a slot: ${editor.userId}`,
                );
            }
        }

        await db.transaction(async (tx) => {
            for (const editor of editors) {
                const slotCode = assignments
                    .find((a) => a.editorIds.includes(editor.userId))
                    ?.slotCode ?? null;
                await tx
                    .update(groupMembers)
                    .set({ permissionSlotCode: slotCode })
                    .where(eq(groupMembers.id, editor.id));
            }
        });

        return this.getGroupPermission(groupId);
    },
};

export async function resolveGroupEditorRefs(
    groupId: string,
    editors: Array<{
        userId: string;
        fullName: string | null;
        permissionSlotCode: string | null;
    }>,
    metadataPermissionConfigId: string | null,
): Promise<Array<{ userId: string; fullName: string | null; allowedFields: string[] | null }>> {
    if (!metadataPermissionConfigId) {
        return editors.map((e) => ({
            userId: e.userId,
            fullName: e.fullName,
            allowedFields: null,
        }));
    }

    const config = await getActiveConfigOrThrow(metadataPermissionConfigId);
    const slotFieldKeysMap = buildSlotFieldKeysMap(config.slots, config.template.fieldCatalog);
    const slotSortOrderByCode = new Map(
        config.slots.map((slot) => [slot.slotCode, slot.sortOrder]),
    );

    return editors.map((e) => {
        if (!e.permissionSlotCode) {
            throw httpError.badRequest(
                `Editor ${e.userId} has no permission slot assigned`,
            );
        }
        const keys = slotFieldKeysMap.get(e.permissionSlotCode);
        if (!keys || keys.length === 0) {
            throw httpError.badRequest(
                `Invalid permission slot for editor ${e.userId}: ${e.permissionSlotCode}`,
            );
        }
        return {
            userId: e.userId,
            fullName: e.fullName,
            allowedFields: keys,
            permissionSlotCode: e.permissionSlotCode,
            slotSortOrder: slotSortOrderByCode.get(e.permissionSlotCode) ?? 0,
        };
    });
}

export function isGroupFieldSplitMode(
    metadataPermissionConfigId: string | null,
    editors: Array<{ permissionSlotCode: string | null }>,
): boolean {
    if (!metadataPermissionConfigId) {
        return false;
    }
    return editors.every((e) => e.permissionSlotCode !== null);
}
