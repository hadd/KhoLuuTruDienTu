import {
    RetentionDurationUnit,
    type RetentionDurationUnit as RetentionDurationUnitType,
} from "../db/schemas/retention-period-enums.ts";
import { formatRetentionDurationLabel } from "../modules/retention-period/format-duration-label.ts";

export type RetentionPeriodComparable = {
    id: string;
    name: string;
    isPermanent: boolean;
    durationValue: number | null;
    durationUnit: RetentionDurationUnitType | null;
};

export type EffectiveRetention = {
    id: string;
    name: string;
    label: string;
    isPermanent: boolean;
    durationValue: number | null;
    durationUnit: RetentionDurationUnitType | null;
};

/** Quy đổi thời hạn sang số ngày để so sánh; Infinity = vĩnh viễn. */
export function retentionDurationInDays(
    period: Pick<
        RetentionPeriodComparable,
        "isPermanent" | "durationValue" | "durationUnit"
    >,
): number | null {
    if (period.isPermanent) return Number.POSITIVE_INFINITY;
    if (period.durationValue == null || period.durationValue < 1 || !period.durationUnit) {
        return null;
    }
    switch (period.durationUnit) {
        case RetentionDurationUnit.YEAR:
            return period.durationValue * 365;
        case RetentionDurationUnit.MONTH:
            return period.durationValue * 30;
        case RetentionDurationUnit.DAY:
            return period.durationValue;
        default:
            return null;
    }
}

/** Chọn thời hạn dài nhất; bỏ qua bản ghi chưa cấu hình. */
export function pickMaxRetentionPeriod<T extends RetentionPeriodComparable>(
    periods: T[],
): T | null {
    let best: T | null = null;
    let bestDays = -1;

    for (const period of periods) {
        const days = retentionDurationInDays(period);
        if (days == null) continue;
        if (days > bestDays) {
            best = period;
            bestDays = days;
        }
    }

    return best;
}

export function toEffectiveRetention(
    period: RetentionPeriodComparable,
): EffectiveRetention {
    return {
        id: period.id,
        name: period.name,
        label: formatRetentionDurationLabel(period),
        isPermanent: period.isPermanent,
        durationValue: period.durationValue,
        durationUnit: period.durationUnit,
    };
}

export function formatEffectiveRetentionDisplay(
    retention: EffectiveRetention | null,
): string | null {
    if (!retention) return null;
    return retention.label !== "Chưa cấu hình" ? retention.label : retention.name;
}
