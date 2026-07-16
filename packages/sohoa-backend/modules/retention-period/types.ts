import { t } from "elysia";
import { RetentionDurationUnit } from "../../db/schemas/retention-period-enums.ts";

export const retentionDurationUnitSchema = t.Enum(RetentionDurationUnit);

export const retentionPeriodEntitySchema = t.Object({
    id: t.String(),
    durationValue: t.Union([t.Number(), t.Null()]),
    durationUnit: t.Union([retentionDurationUnitSchema, t.Null()]),
    isPermanent: t.Boolean(),
    isActive: t.Boolean(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

/** Create only timed periods; permanent is a fixed system row. */
export const createRetentionPeriodSchema = t.Object({
    durationValue: t.Number({ minimum: 1 }),
    durationUnit: retentionDurationUnitSchema,
    isActive: t.Optional(t.Boolean()),
});

export const updateRetentionPeriodSchema = t.Object({
    durationValue: t.Optional(t.Number({ minimum: 1 })),
    durationUnit: t.Optional(retentionDurationUnitSchema),
    isActive: t.Optional(t.Boolean()),
});

export type CreateRetentionPeriodInput = typeof createRetentionPeriodSchema.static;
export type UpdateRetentionPeriodInput = typeof updateRetentionPeriodSchema.static;
