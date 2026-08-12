import { assertEquals } from "@std/assert";

import { DisposalProposalItemSource } from "../db/schemas/archive-disposal-constants.ts";
import {
    formatPl3FormationBody,
    formatPl3FormationHeading,
    listPl3ContentValidationErrors,
    mapPl3ContentToDocxData,
} from "../modules/archive-disposal/disposal-appendix-pl3-content.ts";
import {
    buildPl3CountsDetail,
    buildPl3Suggestions,
} from "../modules/archive-disposal/disposal-appendix-pl3-suggestions.ts";
import {
    PL3_DEFAULT_DUPLICATE_GROUP_SUMMARY,
    PL3_DEFAULT_EXPIRED_GROUP_SUMMARY,
} from "../modules/archive-disposal/disposal-appendix-pl3-templates.ts";
import type { Pl3Content } from "../modules/archive-disposal/disposal-appendix-pl3-types.ts";

const sampleContent: Pl3Content = {
    creatingAgency: "Phòng Hành chính",
    formationMission: "Thực hiện nhiệm vụ hành chính",
    collectionSource: "Kho lưu trữ",
    timePeriod: "2018–2022",
    expiryDuplicateReason: "Hết thời hạn theo quy định",
    priorValuation: "Đã rà soát danh mục",
    countsDetail: "- Tổng: 3",
    timeRangeText: "3. Thời gian: 2018–2022",
    expiredGroupSummary: PL3_DEFAULT_EXPIRED_GROUP_SUMMARY,
    duplicateGroupSummary: PL3_DEFAULT_DUPLICATE_GROUP_SUMMARY,
    otherGroupSummary: "Không.",
};

Deno.test("listPl3ContentValidationErrors rejects missing I.1 answers", () => {
    const errors = listPl3ContentValidationErrors({ ...sampleContent, creatingAgency: "  " });
    assertEquals(errors.length > 0, true);
    assertEquals(errors[0]?.includes("cơ quan"), true);
});

Deno.test("formatPl3FormationHeading uses bullet answers without TT-BNV questions", () => {
    const heading = formatPl3FormationHeading(sampleContent);
    assertEquals(heading.includes("Tài liệu này do cơ quan/bộ phận nào tạo ra?"), false);
    assertEquals(heading.includes("- Phòng Hành chính"), true);
    assertEquals(formatPl3FormationBody(sampleContent).split("\n").length, 6);
    assertEquals(heading.startsWith("1. Sự hình thành khối tài liệu"), true);
});

Deno.test("mapPl3ContentToDocxData maps docx placeholders", () => {
    const data = mapPl3ContentToDocxData("Phông A", "06/2025/TT-BNV", sampleContent);
    assertEquals(data.fondName, "Phông A");
    assertEquals(data.countsHeading.includes("- Tổng: 3"), true);
    assertEquals(data.expiredGroupSummary.includes("1. Nhóm tài liệu hết thời hạn lưu trữ"), true);
    assertEquals(data.otherGroupSummary.includes("3. Các nhóm tài liệu khác"), true);
});

Deno.test("buildPl3CountsDetail aggregates catalog items", () => {
    const detail = buildPl3CountsDetail([
        {
            dossierId: "d1",
            fileId: "f1",
            source: DisposalProposalItemSource.EXPIRED,
        },
        {
            dossierId: "d1",
            fileId: null,
            source: DisposalProposalItemSource.DUPLICATE,
        },
        {
            dossierId: "d2",
            fileId: null,
            source: DisposalProposalItemSource.EXPIRING_SOON,
        },
    ]);
    assertEquals(detail.includes("3 (hồ sơ: 2)"), true);
    assertEquals(detail.includes("hết thời hạn lưu trữ, trùng lặp: 3"), true);
});

Deno.test("buildPl3Suggestions pre-fills templates and stats", () => {
    const content = buildPl3Suggestions({
        fondName: "Phông thử",
        fondAgency: "Cơ quan A",
        fondHistory: "Lịch sử phông",
        catalogCode: "DM-01",
        catalogDate: "2025-08-01",
        items: [
            {
                dossierId: "d1",
                fileId: null,
                source: DisposalProposalItemSource.EXPIRED,
            },
        ],
    });
    assertEquals(content.formationMission, "Lịch sử phông");
    assertEquals(content.collectionSource.includes("DM-01"), true);
    assertEquals(content.expiredGroupSummary, PL3_DEFAULT_EXPIRED_GROUP_SUMMARY);
    assertEquals(content.countsDetail.includes("hồ sơ: 1"), true);
});
