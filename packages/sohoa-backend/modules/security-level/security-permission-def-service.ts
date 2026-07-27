import { and, eq, isNull, ne } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { securityPermissionDefs } from "../../db/schemas/security-permission-def.ts";
import { securityLevelRules } from "../../db/schemas/security-level-rule.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { permissionRuleKey } from "./security-rule-keys.ts";
import {
    createPermissionDefSchema,
    type CreatePermissionDefInput,
    permissionDefEntitySchema,
    type UpdatePermissionDefInput,
    updatePermissionDefSchema,
} from "./types.ts";

async function assertKeyAvailable(key: string, excludeId?: string) {
    const [existing] = await db
        .select({ id: securityPermissionDefs.id })
        .from(securityPermissionDefs)
        .where(
            and(
                eq(securityPermissionDefs.key, key),
                isNull(securityPermissionDefs.deletedAt),
                excludeId ? ne(securityPermissionDefs.id, excludeId) : undefined,
            ),
        )
        .limit(1);
    if (existing) {
        throw httpError.conflict("Mã quyền bảo mật đã tồn tại.");
    }
}

const crud = createCrudService({
    db,
    table: securityPermissionDefs,
    searchable: ["key", "name", "description"],
    entitySchema: permissionDefEntitySchema,
    createSchema: createPermissionDefSchema,
    updateSchema: updatePermissionDefSchema,
    metadata: {
        tags: ["SecurityPermissionDef"],
        descriptions: {
            list: "List security permission definitions.",
            get: "Get a security permission definition by ID.",
            create: "Create a security permission definition.",
            update: "Update a security permission definition.",
            delete: "Soft delete a security permission definition.",
        },
    },
});

export const SecurityPermissionDefService = {
    ...crud,

    async create(input: CreatePermissionDefInput) {
        const key = input.key.trim().toLowerCase();
        await assertKeyAvailable(key);
        const [created] = await db.insert(securityPermissionDefs).values({
            key,
            name: input.name.trim(),
            description: input.description ?? "",
            isSystem: false,
            isActive: input.isActive ?? true,
        }).returning();
        if (!created) {
            throw httpError.badRequest("Không tạo được quyền bảo mật.");
        }

        // Mọi cấp hiện có: quyền mới mặc định TẮT (snapshot độc lập)
        const levels = await db
            .select({ id: securityLevels.id })
            .from(securityLevels)
            .where(isNull(securityLevels.deletedAt));
        const ruleKey = permissionRuleKey(key);
        if (levels.length > 0) {
            await db.insert(securityLevelRules).values(
                levels.map((level) => ({
                    securityLevelId: level.id,
                    ruleKey,
                    isOverridden: true,
                    value: false,
                })),
            );
        }

        return created;
    },

    async update(id: string, input: UpdatePermissionDefInput) {
        const existing = await crud.get(id);
        if (existing.isSystem && input.name === undefined && input.description === undefined && input.isActive === undefined) {
            return existing;
        }
        return crud.update(id, {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        });
    },

    async delete(id: string) {
        const existing = await crud.get(id);
        if (existing.isSystem) {
            throw httpError.conflict("Không thể xóa quyền hệ thống.");
        }

        // Gỡ snapshot rule của quyền này khỏi mọi cấp, rồi soft-delete định nghĩa
        const ruleKey = permissionRuleKey(existing.key);
        await db
            .delete(securityLevelRules)
            .where(eq(securityLevelRules.ruleKey, ruleKey));

        return crud.delete(id);
    },

    async listActive() {
        const items = await db
            .select()
            .from(securityPermissionDefs)
            .where(and(
                eq(securityPermissionDefs.isActive, true),
                isNull(securityPermissionDefs.deletedAt),
            ));
        return { items };
    },
};
