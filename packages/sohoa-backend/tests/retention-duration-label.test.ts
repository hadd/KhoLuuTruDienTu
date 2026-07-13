import { assertEquals } from "@std/assert";
import { RetentionDurationUnit } from "../db/schemas/retention-period-enums.ts";
import { formatRetentionDurationLabel } from "../modules/retention-period/format-duration-label.ts";

Deno.test("formatRetentionDurationLabel", () => {
    assertEquals(
        formatRetentionDurationLabel({
            isPermanent: true,
            durationValue: null,
            durationUnit: null,
        }),
        "Vĩnh viễn",
    );

    assertEquals(
        formatRetentionDurationLabel({
            isPermanent: false,
            durationValue: 10,
            durationUnit: RetentionDurationUnit.YEAR,
        }),
        "10 năm",
    );

    assertEquals(
        formatRetentionDurationLabel({
            isPermanent: false,
            durationValue: 6,
            durationUnit: RetentionDurationUnit.MONTH,
        }),
        "6 tháng",
    );

    assertEquals(
        formatRetentionDurationLabel({
            isPermanent: false,
            durationValue: null,
            durationUnit: null,
        }),
        "Chưa cấu hình",
    );
});
