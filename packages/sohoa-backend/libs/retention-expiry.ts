import type { RetentionDurationUnit as RetentionDurationUnitType } from "../db/schemas/retention-period-enums.ts";
import { RetentionDurationUnit } from "../db/schemas/retention-period-enums.ts";

export type RetentionPeriodDuration = {
    isPermanent: boolean;
    durationValue?: number | null;
    durationUnit?: RetentionDurationUnitType | null;
};

export type RetentionExpiryStatus =
    | "PERMANENT"
    | "UNKNOWN"
    | "OK"
    | "EXPIRING_SOON"
    | "EXPIRED";

export function computeRetentionExpiresAt(
    startAt: Date | string,
    period: RetentionPeriodDuration,
): Date | null {
    if (period.isPermanent) {
        return null;
    }

    const value = period.durationValue;
    const unit = period.durationUnit;
    if (value == null || value < 1 || !unit) {
        return null;
    }

    const expiresAt = new Date(startAt);
    if (Number.isNaN(expiresAt.getTime())) {
        return null;
    }

    switch (unit) {
        case RetentionDurationUnit.YEAR:
            expiresAt.setFullYear(expiresAt.getFullYear() + value);
            return expiresAt;
        case RetentionDurationUnit.MONTH:
            expiresAt.setMonth(expiresAt.getMonth() + value);
            return expiresAt;
        case RetentionDurationUnit.DAY:
            expiresAt.setDate(expiresAt.getDate() + value);
            return expiresAt;
        default:
            return null;
    }
}

export function classifyRetentionStatus(
    expiresAt: Date | null,
    options?: {
        isPermanent?: boolean;
        now?: Date;
        soonDays?: number;
    },
): RetentionExpiryStatus {
    if (options?.isPermanent) {
        return "PERMANENT";
    }
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
        return "UNKNOWN";
    }

    const now = options?.now ?? new Date();
    const soonDays = options?.soonDays ?? 30;
    const soonThreshold = new Date(now);
    soonThreshold.setDate(soonThreshold.getDate() + soonDays);

    if (expiresAt.getTime() < now.getTime()) {
        return "EXPIRED";
    }
    if (expiresAt.getTime() <= soonThreshold.getTime()) {
        return "EXPIRING_SOON";
    }
    return "OK";
}

export function isRetentionCandidateStatus(status: RetentionExpiryStatus): boolean {
    return status === "EXPIRED" || status === "EXPIRING_SOON";
}
