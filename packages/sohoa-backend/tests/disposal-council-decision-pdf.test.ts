import { assertEquals } from "jsr:@std/assert";
import { buildCouncilDecisionPdf } from "../modules/archive-disposal/disposal-council-decision-pdf.ts";

Deno.test("buildCouncilDecisionPdf encodes Vietnamese diacritics", async () => {
    const bytes = await buildCouncilDecisionPdf({
        councilCode: "HD-2026-01",
        catalogCode: "DM-01",
        catalogName: "Danh mục thử Ế — Hội đồng xét hủy",
        publishedAt: new Date("2026-08-07T00:00:00.000Z"),
        rows: [
            {
                label: "Phòng Lưu trữ số",
                decision: "DESTROY",
                hasDissent: true,
            },
        ],
    });
    assertEquals(bytes[0], 0x25);
    assertEquals(bytes[1], 0x50);
    assertEquals(bytes[2], 0x44);
    assertEquals(bytes[3], 0x46);
    assertEquals(bytes.length > 1000, true);
});
