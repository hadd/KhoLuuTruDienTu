import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { roles } from "../../db/schemas/role.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import {
    createSecurityLevelSchema,
    type CreateSecurityLevelInput,
    securityLevelEntitySchema,
    type UpdateSecurityLevelInput,
    updateSecurityLevelSchema,
} from "./types.ts";

async function assertNameAvailable(name: string, excludeId?: string) {
    const [existing] = await db
        .select({ id: securityLevels.id })
        .from(securityLevels)
        .where(
            and(
                sql`lower(${securityLevels.name}) = lower(${name})`,
                isNull(securityLevels.deletedAt),
                excludeId ? ne(securityLevels.id, excludeId) : undefined,
            ),
        )
        .limit(1);

    if (existing) {
        throw httpError.conflict("Tên cấp độ bảo mật đã tồn tại.");
    }
}

async function assertLevelOrderAvailable(levelOrder: number, excludeId?: string) {
    const [existing] = await db
        .select({ id: securityLevels.id })
        .from(securityLevels)
        .where(
            and(
                eq(securityLevels.levelOrder, levelOrder),
                isNull(securityLevels.deletedAt),
                excludeId ? ne(securityLevels.id, excludeId) : undefined,
            ),
        )
        .limit(1);

    if (existing) {
        throw httpError.conflict("Thứ tự cấp độ bảo mật đã tồn tại.");
    }
}

async function assertExportRoleIdsExist(exportRoleIds: string[]) {
    if (exportRoleIds.length === 0) return;

    const uniqueIds = [...new Set(exportRoleIds)];
    const existing = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(inArray(roles.id, uniqueIds), isNull(roles.deletedAt)));

    if (existing.length !== uniqueIds.length) {
        const existingIds = new Set(existing.map((r) => r.id));
        const missing = uniqueIds.filter((id) => !existingIds.has(id));
        throw httpError.badRequest(
            `Vai trò không tồn tại: ${missing.join(", ")}`,
        );
    }
}

async function assertNotLastActiveLevel(excludeId: string) {
    const [other] = await db
        .select({ id: securityLevels.id })
        .from(securityLevels)
        .where(
            and(
                eq(securityLevels.isActive, true),
                isNull(securityLevels.deletedAt),
                ne(securityLevels.id, excludeId),
            ),
        )
        .limit(1);

    if (!other) {
        throw httpError.conflict(
            "Phải có ít nhất một cấp độ bảo mật đang hoạt động.",
        );
    }
}

function isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === "23505";
}

const crud = createCrudService({
    db,
    table: securityLevels,
    searchable: ["name", "description"],
    entitySchema: securityLevelEntitySchema,
    createSchema: createSecurityLevelSchema,
    updateSchema: updateSecurityLevelSchema,
    metadata: {
        tags: ["SecurityLevel"],
        descriptions: {
            list: "List security levels with pagination, filtering and search.",
            get: "Get a security level by ID.",
            create: "Create a security level record.",
            update: "Update a security level record.",
            delete: "Soft delete a security level record.",
        },
    },
});

export const SecurityLevelService = {
    ...crud,

    async listActive() {
        const items = await db
            .select()
            .from(securityLevels)
            .where(and(
                eq(securityLevels.isActive, true),
                isNull(securityLevels.deletedAt),
            ))
            .orderBy(asc(securityLevels.levelOrder));
        return { items };
    },

    async create(input: CreateSecurityLevelInput) {
        const name = input.name.trim();
        if (!name) {
            throw httpError.badRequest("Tên cấp độ bảo mật không được để trống.");
        }

        await assertNameAvailable(name);
        await assertLevelOrderAvailable(input.levelOrder);
        await assertExportRoleIdsExist(input.exportRoleIds ?? []);

        try {
            return await crud.create({
                ...input,
                name,
                description: input.description ?? "",
                exportRoleIds: input.exportRoleIds ?? [],
                isActive: input.isActive ?? true,
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw httpError.conflict("Tên hoặc thứ tự cấp độ bảo mật đã tồn tại.");
            }
            throw error;
        }
    },

    async update(id: string, input: UpdateSecurityLevelInput) {
        const existing = await crud.get(id);

        const name = input.name?.trim();
        if (name !== undefined && !name) {
            throw httpError.badRequest("Tên cấp độ bảo mật không được để trống.");
        }

        if (name !== undefined && name.toLowerCase() !== existing.name.toLowerCase()) {
            await assertNameAvailable(name, id);
        }
        if (input.levelOrder !== undefined && input.levelOrder !== existing.levelOrder) {
            await assertLevelOrderAvailable(input.levelOrder, id);
        }
        if (input.exportRoleIds !== undefined) {
            await assertExportRoleIdsExist(input.exportRoleIds);
        }
        if (input.isActive === false && existing.isActive) {
            await assertNotLastActiveLevel(id);
        }

        try {
            return await crud.update(id, {
                ...input,
                ...(name !== undefined ? { name } : {}),
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw httpError.conflict("Tên hoặc thứ tự cấp độ bảo mật đã tồn tại.");
            }
            throw error;
        }
    },

    async delete(id: string) {
        const existing = await crud.get(id);
        if (existing.isActive) {
            await assertNotLastActiveLevel(id);
        }
        return crud.delete(id);
    },
};
