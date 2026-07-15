import { and, eq, ne } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import type { RetentionDurationUnit } from "../../db/schemas/retention-period-enums.ts";
import { retentionPeriods } from "../../db/schemas/retention-period.ts";
import { PERMANENT_RETENTION_PERIOD_ID } from "./constants.ts";
import {
    createRetentionPeriodSchema,
    type CreateRetentionPeriodInput,
    retentionPeriodEntitySchema,
    type UpdateRetentionPeriodInput,
    updateRetentionPeriodSchema,
} from "./types.ts";

type NormalizedTimedDuration = {
    isPermanent: false;
    durationValue: number;
    durationUnit: RetentionDurationUnit;
};

function normalizeTimedDuration(input: {
    durationValue: number;
    durationUnit: RetentionDurationUnit;
}): NormalizedTimedDuration {
    if (input.durationValue < 1) {
        throw httpError.badRequest("Thời lượng phải >= 1");
    }

    return {
        isPermanent: false,
        durationValue: input.durationValue,
        durationUnit: input.durationUnit,
    };
}

async function assertNoDuplicateTimedDuration(
    duration: NormalizedTimedDuration,
    excludeId?: string,
) {
    const [existing] = await db
        .select({ id: retentionPeriods.id })
        .from(retentionPeriods)
        .where(
            and(
                eq(retentionPeriods.isPermanent, false),
                eq(retentionPeriods.durationValue, duration.durationValue),
                eq(retentionPeriods.durationUnit, duration.durationUnit),
                excludeId ? ne(retentionPeriods.id, excludeId) : undefined,
            ),
        )
        .limit(1);

    if (existing) {
        throw httpError.conflict(
            "Đã tồn tại thời hạn với cùng thời lượng và đơn vị.",
        );
    }
}

async function ensurePermanentPeriod() {
    const [existing] = await db
        .select({ id: retentionPeriods.id })
        .from(retentionPeriods)
        .where(eq(retentionPeriods.isPermanent, true))
        .limit(1);

    if (existing) return;

    await db.insert(retentionPeriods).values({
        id: PERMANENT_RETENTION_PERIOD_ID,
        isPermanent: true,
        isActive: true,
        durationValue: null,
        durationUnit: null,
    });
}

const crud = createCrudService({
    db,
    table: retentionPeriods,
    searchable: [],
    entitySchema: retentionPeriodEntitySchema,
    createSchema: createRetentionPeriodSchema,
    updateSchema: updateRetentionPeriodSchema,
    metadata: {
        tags: ["RetentionPeriod"],
        descriptions: {
            list: "List retention periods with pagination, filtering and search.",
            get: "Get a retention period by ID.",
            create: "Create a timed retention period (permanent is system-fixed).",
            update: "Update a timed retention period (cannot update ID).",
            delete: "Delete a timed retention period (permanent cannot be deleted).",
        },
    },
});

export const RetentionPeriodService = {
    ...crud,
    async list(query?: Parameters<typeof crud.list>[0]) {
        await ensurePermanentPeriod();
        const result = await crud.list(query);
        const items = [...(result.items ?? [])].sort((a, b) => {
            if (a.isPermanent === b.isPermanent) return 0;
            return a.isPermanent ? -1 : 1;
        });
        return { ...result, items };
    },
    async listActive() {
        await ensurePermanentPeriod();
        const items = await db
            .select()
            .from(retentionPeriods)
            .where(eq(retentionPeriods.isActive, true));
        items.sort((a, b) => {
            if (a.isPermanent === b.isPermanent) return 0;
            return a.isPermanent ? -1 : 1;
        });
        return { items };
    },
    async create(input: CreateRetentionPeriodInput) {
        await ensurePermanentPeriod();
        const duration = normalizeTimedDuration(input);
        await assertNoDuplicateTimedDuration(duration);
        return crud.create({
            id: crypto.randomUUID(),
            isActive: input.isActive ?? true,
            ...duration,
        });
    },
    async update(id: string, input: UpdateRetentionPeriodInput) {
        const existing = await crud.get(id);

        if (existing.isPermanent) {
            if (input.durationValue !== undefined || input.durationUnit !== undefined) {
                throw httpError.badRequest(
                    "Không thể sửa thời lượng của thời hạn vĩnh viễn.",
                );
            }
            if (input.isActive === undefined) {
                throw httpError.badRequest(
                    "Không thể sửa thời hạn vĩnh viễn (mục hệ thống cố định).",
                );
            }
            return crud.update(id, {
                isActive: input.isActive,
                updatedAt: new Date(),
            });
        }

        const nextDuration =
            input.durationValue !== undefined || input.durationUnit !== undefined
                ? normalizeTimedDuration({
                    durationValue: input.durationValue ?? existing.durationValue!,
                    durationUnit: input.durationUnit ?? existing.durationUnit!,
                })
                : null;

        if (nextDuration) {
            await assertNoDuplicateTimedDuration(nextDuration, id);
        }

        return crud.update(id, {
            ...(nextDuration ?? {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            updatedAt: new Date(),
        });
    },
    async delete(id: string) {
        const existing = await crud.get(id);
        if (existing.isPermanent) {
            throw httpError.badRequest(
                "Không thể xóa thời hạn vĩnh viễn (mục hệ thống cố định).",
            );
        }
        return crud.delete(id);
    },
};
