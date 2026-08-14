import { assertEquals } from "@std/assert";
import { buildCouncilMinutesPdf } from "../modules/archive-disposal/disposal-minutes-pdf.ts";

Deno.test("buildCouncilMinutesPdf returns non-empty PDF", async () => {
    const pdf = await buildCouncilMinutesPdf({
        title: "BIÊN BẢN Họp Hội đồng xét hủy tài liệu lưu trữ",
        councilCode: "HĐH-TEST",
        catalogCode: "DM-01",
        catalogName: "Danh mục thử",
        meetingDate: new Date("2026-08-14"),
        members: [{ fullName: "Nguyễn A", positionLabel: "Chủ tịch", excusedAbsent: false }],
        outcomes: [{
            label: "Hồ sơ 1",
            decision: "DESTROY",
            hasDissent: false,
            chairReason: null,
        }],
        evaluations: [{
            memberName: "Nguyễn A",
            positionLabel: "Chủ tịch",
            itemLabel: "Hồ sơ 1",
            decision: "DESTROY",
            note: "Hết thời hạn",
        }],
        summaryLine: "Tóm tắt phiên họp.",
    });
    assertEquals(pdf.length > 1000, true);
    assertEquals(String.fromCharCode(...pdf.slice(0, 4)), "%PDF");
});
