import { t } from "elysia";
import { RetentionDurationUnit } from "../../db/schemas/retention-period-enums.ts";

export const retentionDurationUnitSchema = t.Enum(RetentionDurationUnit);

export const retentionPeriodEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.String(),
    durationValue: t.Union([t.Number(), t.Null()]),
    durationUnit: t.Union([retentionDurationUnitSchema, t.Null()]),
    isPermanent: t.Boolean(),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});

export const createRetentionPeriodSchema = t.Object({
    id: t.String({ maxLength: 50, minLength: 1, description: "Mã thời hạn lưu trữ" }),
    name: t.String({ maxLength: 255 }),
    description: t.Optional(t.String()),
    isPermanent: t.Optional(t.Boolean({ default: false })),
    durationValue: t.Optional(t.Union([t.Number({ minimum: 1 }), t.Null()])),
    durationUnit: t.Optional(t.Union([retentionDurationUnitSchema, t.Null()])),
});

export const updateRetentionPeriodSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255 })),
    description: t.Optional(t.String()),
    isPermanent: t.Optional(t.Boolean()),
    durationValue: t.Optional(t.Union([t.Number({ minimum: 1 }), t.Null()])),
    durationUnit: t.Optional(t.Union([retentionDurationUnitSchema, t.Null()])),
});

export type CreateRetentionPeriodInput = typeof createRetentionPeriodSchema.static;
export type UpdateRetentionPeriodInput = typeof updateRetentionPeriodSchema.static;
