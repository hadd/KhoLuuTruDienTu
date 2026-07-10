import { schema } from "./schema-helper.ts";

export const RetentionDurationUnit = {
    YEAR: "YEAR",
    MONTH: "MONTH",
    DAY: "DAY",
} as const;

export type RetentionDurationUnit =
    (typeof RetentionDurationUnit)[keyof typeof RetentionDurationUnit];

export const RETENTION_DURATION_UNIT_VALUES = Object.values(RetentionDurationUnit) as [
    RetentionDurationUnit,
    RetentionDurationUnit,
    RetentionDurationUnit,
];

export const retentionDurationUnitEnum = schema.enum(
    "retention_duration_unit",
    RETENTION_DURATION_UNIT_VALUES,
);
