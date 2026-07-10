import type { RetentionDurationUnit } from "../../db/schemas/retention-period-enums.ts";
import { RetentionDurationUnit as DurationUnit } from "../../db/schemas/retention-period-enums.ts";

type RetentionDurationFields = {
    isPermanent: boolean;
    durationValue: number | null;
    durationUnit: RetentionDurationUnit | null;
};

export function formatRetentionDurationLabel(
    period: RetentionDurationFields,
): string {
    if (period.isPermanent) {
        return "Vĩnh viễn";
    }

    if (period.durationValue == null || !period.durationUnit) {
        return "Chưa cấu hình";
    }

    const value = period.durationValue;
    switch (period.durationUnit) {
        case DurationUnit.YEAR:
            return `${value} năm`;
        case DurationUnit.MONTH:
            return `${value} tháng`;
        case DurationUnit.DAY:
            return `${value} ngày`;
        default:
            return "Chưa cấu hình";
    }
}
