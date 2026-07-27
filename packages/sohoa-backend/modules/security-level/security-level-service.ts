import { and, asc, eq, isNull, lt, ne, sql, count, desc } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { securityLevels } from "../../db/schemas/security-level.ts";
import { securityLevelRules } from "../../db/schemas/security-level-rule.ts";
import { hashPassword } from "../../libs/helpers/password.ts";
import {
    buildDefaultSnapshot,
    buildSnapshotFromLevel,
    ensureLevelSnapshotComplete,
    getEffectiveValue,
    insertSnapshotRules,
    isLooserThanLower,
    listActiveLevelsOrdered,
    resolveEffectiveRules,
} from "./security-clearance.ts";
import { FlagRuleKey } from "./security-rule-keys.ts";
import {
    createSecurityLevelSchema,
    type CreateSecurityLevelInput,
    type PatchSecurityLevelRulesInput,
    securityLevelEntitySchema,
    type UpdateSecurityLevelInput,
    updateSecurityLevelSchema,
} from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
    if (!Number.isInteger(levelOrder) || levelOrder < 1) {
        throw httpError.badRequest("Thứ tự cấp độ phải là số nguyên >= 1.");
    }

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

function toPublicRecord(row: typeof securityLevels.$inferSelect) {
    const { passwordHash: _pw, ...rest } = row;
    return {
        ...rest,
        hasPassword: Boolean(_pw),
    };
}

async function upsertLevelRule(
    tx: DbTx,
    securityLevelId: string,
    ruleKey: string,
    value: unknown,
) {
    const existing = await tx
        .select()
        .from(securityLevelRules)
        .where(and(
            eq(securityLevelRules.securityLevelId, securityLevelId),
            eq(securityLevelRules.ruleKey, ruleKey),
        ))
        .limit(1);

    if (existing[0]) {
        await tx
            .update(securityLevelRules)
            .set({
                isOverridden: true,
                value,
                updatedAt: new Date(),
            })
            .where(eq(securityLevelRules.id, existing[0].id));
        return;
    }

    await tx.insert(securityLevelRules).values({
        securityLevelId,
        ruleKey,
        isOverridden: true,
        value,
    });
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

    async list(urlQuery: Parameters<typeof crud.list>[0]) {
        const result = await crud.list(urlQuery);
        return {
            ...result,
            items: (result.items as Array<typeof securityLevels.$inferSelect>).map(toPublicRecord),
        };
    },

    async get(id: string) {
        const record = await crud.get(id);
        return toPublicRecord(record as typeof securityLevels.$inferSelect);
    },

    async listActive() {
        const items = await db
            .select()
            .from(securityLevels)
            .where(and(
                eq(securityLevels.isActive, true),
                isNull(securityLevels.deletedAt),
            ))
            .orderBy(asc(securityLevels.levelOrder));
        return { items: items.map(toPublicRecord) };
    },

    async create(input: CreateSecurityLevelInput) {
        const name = input.name.trim();
        if (!name) {
            throw httpError.badRequest("Tên cấp độ bảo mật không được để trống.");
        }

        const levelOrder = input.levelOrder;
        await assertNameAvailable(name);
        await assertLevelOrderAvailable(levelOrder);

        // Snapshot from adjacent lower level (highest order among levels < new order)
        const [lower] = await db
            .select({ id: securityLevels.id })
            .from(securityLevels)
            .where(and(
                isNull(securityLevels.deletedAt),
                lt(securityLevels.levelOrder, levelOrder),
            ))
            .orderBy(desc(securityLevels.levelOrder))
            .limit(1);

        try {
            const [created] = await db.insert(securityLevels).values({
                name,
                description: input.description ?? "",
                levelOrder,
                isActive: input.isActive ?? true,
            }).returning();
            if (!created) {
                throw httpError.badRequest("Không tạo được cấp độ bảo mật.");
            }

            const snapshot = lower
                ? await buildSnapshotFromLevel(lower.id)
                : await buildDefaultSnapshot();
            await insertSnapshotRules(created.id, snapshot, {
                isOverridden: !lower,
            });

            return toPublicRecord(created);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw httpError.conflict("Tên hoặc thứ tự cấp độ bảo mật đã tồn tại.");
            }
            throw error;
        }
    },

    async update(id: string, input: UpdateSecurityLevelInput) {
        const existing = await crud.get(id) as typeof securityLevels.$inferSelect;

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
        if (input.isActive === false && existing.isActive) {
            await assertNotLastActiveLevel(id);
        }

        try {
            const updated = await crud.update(id, {
                ...(name !== undefined ? { name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                ...(input.levelOrder !== undefined ? { levelOrder: input.levelOrder } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            });
            return toPublicRecord(updated as typeof securityLevels.$inferSelect);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw httpError.conflict("Tên hoặc thứ tự cấp độ bảo mật đã tồn tại.");
            }
            throw error;
        }
    },

    async delete(id: string) {
        const existing = await crud.get(id) as typeof securityLevels.$inferSelect;

        const [usage] = await db
            .select({ total: count() })
            .from(dossiers)
            .where(and(
                eq(dossiers.securityLevelId, id),
                isNull(dossiers.deletedAt),
            ));

        if (Number(usage?.total ?? 0) > 0) {
            throw httpError.conflict(
                `Không thể xóa cấp độ đang được gắn cho ${usage?.total} hồ sơ. Hãy đổi cấp hồ sơ trước.`,
            );
        }

        if (existing.isActive) {
            await assertNotLastActiveLevel(id);
        }

        const record = await crud.delete(id);
        return toPublicRecord(record as typeof securityLevels.$inferSelect);
    },

    async getRules(id: string) {
        await crud.get(id);
        await ensureLevelSnapshotComplete(id);
        const rules = await resolveEffectiveRules(id);
        const level = await crud.get(id) as typeof securityLevels.$inferSelect;
        return {
            securityLevelId: id,
            hasPassword: Boolean(level.passwordHash),
            rules,
        };
    },

    async patchRules(id: string, input: PatchSecurityLevelRulesInput) {
        const level = await crud.get(id) as typeof securityLevels.$inferSelect;
        const currentEffective = await resolveEffectiveRules(id);

        const levels = await listActiveLevelsOrdered();
        const idx = levels.findIndex((l) => l.id === id);
        const lowerId = idx > 0 ? levels[idx - 1]!.id : null;

        const looserKeys: string[] = [];
        for (const patch of input.rules) {
            if (!lowerId) continue;
            const lowerEffective = await getEffectiveValue(lowerId, patch.ruleKey);
            const nextValue = patch.value ?? false;
            if (isLooserThanLower(patch.ruleKey, lowerEffective, nextValue)) {
                looserKeys.push(patch.ruleKey);
            }
        }

        if (looserKeys.length > 0 && !input.confirmLooser) {
            throw httpError.badRequest(
                `Cấu hình nới lỏng hơn cấp thấp hơn (${looserKeys.join(", ")}). Gửi confirmLooser=true để xác nhận.`,
            );
        }

        let nextPasswordHash = level.passwordHash;
        if (input.clearPassword) {
            nextPasswordHash = null;
        } else if (input.password != null && input.password !== "") {
            nextPasswordHash = await hashPassword(input.password);
        }

        const requirePatch = input.rules.find((r) => r.ruleKey === FlagRuleKey.requirePassword);
        let requirePasswordEffective = Boolean(
            currentEffective.find((r) => r.ruleKey === FlagRuleKey.requirePassword)?.effectiveValue,
        );
        if (requirePatch) {
            requirePasswordEffective = Boolean(requirePatch.value);
        }

        if (requirePasswordEffective && !nextPasswordHash) {
            throw httpError.badRequest(
                "Khi bật yêu cầu mật khẩu cấp, phải nhập mật khẩu trước khi lưu.",
            );
        }

        await db.transaction(async (tx) => {
            if (input.clearPassword || (input.password != null && input.password !== "")) {
                await tx
                    .update(securityLevels)
                    .set({ passwordHash: nextPasswordHash, updatedAt: new Date() })
                    .where(eq(securityLevels.id, id));
            }

            for (const patch of input.rules) {
                const value = patch.value ?? false;
                await upsertLevelRule(tx, id, patch.ruleKey, value);
            }
        });

        return this.getRules(id);
    },
};
