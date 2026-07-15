import { assertEquals } from "@std/assert";
import { RetentionDurationUnit } from "../db/schemas/retention-period-enums.ts";
import {
    pickMaxRetentionPeriod,
    retentionDurationInDays,
} from "../libs/retention-compare.ts";

Deno.test("retentionDurationInDays", () => {
    assertEquals(
        retentionDurationInDays({
            isPermanent: true,
            durationValue: null,
            durationUnit: null,
        }),
        Number.POSITIVE_INFINITY,
    );
    assertEquals(
        retentionDurationInDays({
            isPermanent: false,
            durationValue: 2,
            durationUnit: RetentionDurationUnit.YEAR,
        }),
        730,
    );
    assertEquals(
        retentionDurationInDays({
            isPermanent: false,
            durationValue: 6,
            durationUnit: RetentionDurationUnit.MONTH,
        }),
        180,
    );
    assertEquals(
        retentionDurationInDays({
            isPermanent: false,
            durationValue: null,
            durationUnit: null,
        }),
        null,
    );
});

Deno.test("pickMaxRetentionPeriod prefers permanent then longest finite", () => {
    const permanent = {
        id: "vv",
        name: "Vĩnh viễn",
        isPermanent: true,
        durationValue: null,
        durationUnit: null,
    };
    const tenYears = {
        id: "10y",
        name: "10 năm",
        isPermanent: false,
        durationValue: 10,
        durationUnit: RetentionDurationUnit.YEAR,
    };
    const fiveYears = {
        id: "5y",
        name: "5 năm",
        isPermanent: false,
        durationValue: 5,
        durationUnit: RetentionDurationUnit.YEAR,
    };
    const unconfigured = {
        id: "na",
        name: "N/A",
        isPermanent: false,
        durationValue: null,
        durationUnit: null,
    };

    assertEquals(
        pickMaxRetentionPeriod([fiveYears, tenYears, unconfigured])?.id,
        "10y",
    );
    assertEquals(
        pickMaxRetentionPeriod([tenYears, permanent, fiveYears])?.id,
        "vv",
    );
    assertEquals(pickMaxRetentionPeriod([unconfigured]), null);
});
