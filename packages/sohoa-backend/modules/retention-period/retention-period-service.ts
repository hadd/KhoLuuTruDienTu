import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import type { RetentionDurationUnit } from "../../db/schemas/retention-period-enums.ts";
import { retentionPeriods } from "../../db/schemas/retention-period.ts";
import {
    createRetentionPeriodSchema,
    type CreateRetentionPeriodInput,
    retentionPeriodEntitySchema,
    type UpdateRetentionPeriodInput,
    updateRetentionPeriodSchema,
} from "./types.ts";

type RetentionPeriodDurationInput = {
    isPermanent?: boolean;
    durationValue?: number | null;
    durationUnit?: RetentionDurationUnit | null;
};

function normalizeRetentionPeriodDuration(
    input: RetentionPeriodDurationInput,
): {
    isPermanent: boolean;
    durationValue: number | null;
    durationUnit: RetentionDurationUnit | null;
} {
    const isPermanent = input.isPermanent ?? false;

    if (isPermanent) {
        return {
            isPermanent: true,
            durationValue: null,
            durationUnit: null,
        };
    }

    if (input.durationValue == null || input.durationValue < 1) {
        throw httpError.badRequest("Thời lượng phải >= 1 khi thời hạn không phải vĩnh viễn");
    }

    if (!input.durationUnit) {
        throw httpError.badRequest("Đơn vị thời hạn là bắt buộc khi không phải vĩnh viễn");
    }

    return {
        isPermanent: false,
        durationValue: input.durationValue,
        durationUnit: input.durationUnit,
    };
}

function buildCreatePayload(input: CreateRetentionPeriodInput) {
    const duration = normalizeRetentionPeriodDuration(input);
    return {
        id: input.id,
        name: input.name,
        description: input.description ?? "",
        ...duration,
    };
}

type ExistingRetentionPeriod = {
    isPermanent: boolean;
    durationValue: number | null;
    durationUnit: RetentionDurationUnit | null;
};

function buildUpdatePayload(
    existing: ExistingRetentionPeriod,
    input: UpdateRetentionPeriodInput,
) {
    const duration = normalizeRetentionPeriodDuration({
        isPermanent: input.isPermanent ?? existing.isPermanent,
        durationValue: input.durationValue !== undefined
            ? input.durationValue
            : existing.durationValue,
        durationUnit: input.durationUnit !== undefined
            ? input.durationUnit
            : existing.durationUnit,
    });

    return {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...duration,
        updatedAt: new Date(),
    };
}

const crud = createCrudService({
    db,
    table: retentionPeriods,
    searchable: ["id", "name", "description"],
    entitySchema: retentionPeriodEntitySchema,
    createSchema: createRetentionPeriodSchema,
    updateSchema: updateRetentionPeriodSchema,
    metadata: {
        tags: ["RetentionPeriod"],
        descriptions: {
            list: "List retention periods with pagination, filtering and search.",
            get: "Get a retention period by ID.",
            create: "Create a retention period record.",
            update: "Update a retention period record (cannot update ID).",
            delete: "Delete a retention period record.",
        },
    },
});

export const RetentionPeriodService = {
    ...crud,
    async create(input: CreateRetentionPeriodInput) {
        return crud.create(buildCreatePayload(input));
    },
    async update(id: string, input: UpdateRetentionPeriodInput) {
        const existing = await crud.get(id);
        return crud.update(id, buildUpdatePayload(existing, input));
    },
};
