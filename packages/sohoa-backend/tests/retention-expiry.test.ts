import { assertEquals } from "@std/assert";
import { RetentionDurationUnit } from "../db/schemas/retention-period-enums.ts";
import {
    classifyRetentionStatus,
    computeRetentionExpiresAt,
    isRetentionCandidateStatus,
} from "../libs/retention-expiry.ts";

Deno.test("computeRetentionExpiresAt adds years/months/days", () => {
    const start = new Date("2020-01-15T00:00:00.000Z");
    assertEquals(
        computeRetentionExpiresAt(start, {
            isPermanent: false,
            durationValue: 2,
            durationUnit: RetentionDurationUnit.YEAR,
        })?.toISOString(),
        "2022-01-15T00:00:00.000Z",
    );
    assertEquals(
        computeRetentionExpiresAt(start, {
            isPermanent: false,
            durationValue: 1,
            durationUnit: RetentionDurationUnit.MONTH,
        })?.toISOString(),
        "2020-02-15T00:00:00.000Z",
    );
    assertEquals(
        computeRetentionExpiresAt(start, {
            isPermanent: true,
            durationValue: null,
            durationUnit: null,
        }),
        null,
    );
});

Deno.test("classifyRetentionStatus handles permanent, unknown, expired, expiring soon", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");

    assertEquals(
        classifyRetentionStatus(null, { isPermanent: true, now }),
        "PERMANENT",
    );
    assertEquals(classifyRetentionStatus(null, { now }), "UNKNOWN");

    assertEquals(
        classifyRetentionStatus(new Date("2026-05-01T00:00:00.000Z"), { now }),
        "EXPIRED",
    );

    assertEquals(
        classifyRetentionStatus(new Date("2026-06-20T00:00:00.000Z"), { now }),
        "EXPIRING_SOON",
    );

    assertEquals(
        classifyRetentionStatus(new Date("2026-06-30T00:00:00.000Z"), { now }),
        "EXPIRING_SOON",
    );

    assertEquals(
        classifyRetentionStatus(new Date("2026-07-02T00:00:00.000Z"), { now }),
        "OK",
    );
});

Deno.test("isRetentionCandidateStatus only expired and expiring soon", () => {
    assertEquals(isRetentionCandidateStatus("EXPIRED"), true);
    assertEquals(isRetentionCandidateStatus("EXPIRING_SOON"), true);
    assertEquals(isRetentionCandidateStatus("OK"), false);
    assertEquals(isRetentionCandidateStatus("PERMANENT"), false);
});
