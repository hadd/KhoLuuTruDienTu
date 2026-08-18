import { assertEquals } from "@std/assert";
import PizZip from "pizzip";

import { buildPlainTextDocx } from "../modules/archive-disposal/disposal-asset-docx.ts";
import {
    parseDocxBlocks,
    renderTipTapIntoAssetDocx,
} from "../modules/archive-disposal/disposal-docx-blocks.ts";
import {
    buildPl3TipTap,
    tipTapDocumentToPlainText,
    type TipTapNode,
} from "../modules/archive-disposal/disposal-document-tiptap.ts";
import { renderTipTapDocumentToDocx } from "../modules/archive-disposal/disposal-document-render.ts";
import { loadAssetDocxTemplate } from "../modules/archive-disposal/disposal-asset-docx.ts";

function countNodes(nodes: TipTapNode[] | undefined, type: string): number {
    let count = 0;
    for (const node of nodes ?? []) {
        if (node.type === type) count++;
        count += countNodes(node.content, type);
    }
    return count;
}

Deno.test("parseDocxBlocks keeps header table cells separate", async () => {
    const bytes = await loadAssetDocxTemplate("MINUTES_COUNCIL");
    const blocks = parseDocxBlocks(bytes);
    const tables = blocks.filter((b) => b.type === "table");
    assertEquals(tables.length > 0, true);
    const firstTable = tables[0];
    if (firstTable?.type !== "table") throw new Error("expected table");
    const firstRow = firstTable.table.rows[0] ?? [];
    assertEquals(firstRow.length >= 2, true);
    const left = firstRow[0]?.map((p) => p.text).join("") ?? "";
    const right = firstRow[1]?.map((p) => p.text).join("") ?? "";
    assertEquals(left.includes("HỘI ĐỒNG") || left.includes("BỘ"), true);
    assertEquals(right.includes("CỘNG HÒA") || right.includes("Độc lập"), true);
    assertEquals(left.includes("CỘNG HÒA"), false);
});

Deno.test("buildCouncilMinutesTipTapFromAsset uses official form from assets", async () => {
    const { buildCouncilMinutesTipTapFromAsset, buildCouncilMinutesDocxFromData } = await import(
        "../modules/archive-disposal/disposal-minutes-docx.ts"
    );
    const input = {
        councilCode: "HD-01",
        catalogCode: "DM-01",
        catalogName: "Danh mục test",
        meetingDate: new Date("2026-08-14T00:00:00.000Z"),
        members: [{ fullName: "Nguyễn A", positionLabel: "Chủ tịch", excusedAbsent: false }],
        outcomes: [{
            label: "HS-1",
            decision: "DESTROY" as const,
            hasDissent: false,
            chairReason: null,
        }],
        evaluations: [{
            memberName: "Nguyễn A",
            positionLabel: "Chủ tịch",
            itemLabel: "HS-1",
            decision: "DESTROY" as const,
            note: "",
        }],
        summaryLine: "Tóm tắt cuộc họp.",
    };
    const doc = await buildCouncilMinutesTipTapFromAsset(input);
    const text = tipTapDocumentToPlainText(doc);
    assertEquals(countNodes(doc.content, "table") > 0, true);
    assertEquals(text.includes("BIÊN BẢN"), true);
    assertEquals(text.includes("Họp Hội đồng xét hủy tài liệu lưu trữ"), true);
    assertEquals(text.includes("Nguyễn A"), true);
    assertEquals(text.includes("DM-01"), true);
    assertEquals(text.includes("BỘ GIÁO DỤC VÀ ĐÀO TẠOHỘI ĐỒNG"), false);

    const { docx } = await buildCouncilMinutesDocxFromData(input);
    assertEquals(docx[0], 0x50);
    assertEquals(docx[1], 0x4b);
    const zip = new PizZip(docx);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    assertEquals(xml.includes("<w:tbl"), true);
    assertEquals(xml.includes("BIÊN BẢN"), true);
});

Deno.test("buildDestructionMinutesTipTapFromAsset keeps Phu luc 06 title", async () => {
    const { buildDestructionMinutesTipTapFromAsset, buildDestructionMinutesDocxFromData } = await import(
        "../modules/archive-disposal/disposal-minutes-docx.ts"
    );
    const input = {
        councilCode: "HD-01",
        catalogCode: "DM-01",
        catalogName: "Danh mục test",
        meetingDate: new Date("2026-08-14T00:00:00.000Z"),
        members: [{ fullName: "Nguyễn A", positionLabel: "Chủ tịch", excusedAbsent: false }],
        outcomes: [{
            label: "HS-1",
            decision: "DESTROY" as const,
            hasDissent: false,
            chairReason: null,
        }],
        destructionSummary: "Đề nghị hủy tài liệu hết hạn.",
        destroyCount: 1,
    };
    const doc = await buildDestructionMinutesTipTapFromAsset(input);
    const text = tipTapDocumentToPlainText(doc);
    assertEquals(countNodes(doc.content, "table") > 0, true);
    assertEquals(text.includes("BIÊN BẢN"), true);
    assertEquals(text.includes("Về việc hủy hồ sơ, tài liệu hết giá trị"), true);
    assertEquals(text.includes("PHỤ LỤC 06") || text.includes("PHỤ LỤC"), true);

    const docx = await renderTipTapIntoAssetDocx("MINUTES_DESTRUCTION", doc);
    const zip = new PizZip(docx);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    assertEquals(xml.includes("<w:tbl"), true);
    const { docx: fromData } = await buildDestructionMinutesDocxFromData(input);
    assertEquals(fromData[0], 0x50);
});

Deno.test("buildPl3TipTap includes fond name", () => {
    const doc = buildPl3TipTap({
        fondName: "Phông A",
        formationHeading: "Nội dung hình thành",
        countsHeading: "Số lượng",
        timeRangeText: "Thời gian",
        expiredGroupBlock: "Nhóm hết hạn",
        duplicateGroupBlock: "Nhóm trùng",
        otherGroupBlock: "Khác",
    });
    const text = tipTapDocumentToPlainText(doc);
    assertEquals(text.includes("Phông A"), true);
});

Deno.test("renderTipTapDocumentToDocx returns docx zip bytes", () => {
    const doc = buildPl3TipTap({
        fondName: "Phông A",
        formationHeading: "Hình thành",
        countsHeading: "Số lượng",
        timeRangeText: "Thời gian",
        expiredGroupBlock: "Hết hạn",
        duplicateGroupBlock: "Trùng",
        otherGroupBlock: "Khác",
    });
    const bytes = renderTipTapDocumentToDocx(doc, "BẢN THUYẾT MINH");
    assertEquals(bytes[0], 0x50);
    assertEquals(bytes[1], 0x4b);
});

Deno.test("renderTipTapIntoAssetDocx embeds Times New Roman on every run", async () => {
    const { buildDestructionMinutesTipTapFromAsset } = await import(
        "../modules/archive-disposal/disposal-minutes-docx.ts"
    );
    const doc = await buildDestructionMinutesTipTapFromAsset({
        councilCode: "HD-01",
        catalogCode: "DM-01",
        catalogName: "Danh mục test",
        meetingDate: new Date("2026-08-14T00:00:00.000Z"),
        members: [{ fullName: "Nguyễn A", positionLabel: "Chủ tịch", excusedAbsent: false }],
        outcomes: [{
            label: "HS-1",
            decision: "DESTROY" as const,
            hasDissent: false,
            chairReason: null,
        }],
        destructionSummary: "Đề nghị hủy tài liệu hết hạn.",
        destroyCount: 1,
    });
    const docx = await renderTipTapIntoAssetDocx("MINUTES_DESTRUCTION", doc);
    const xml = new PizZip(docx).file("word/document.xml")?.asText() ?? "";
    const runs = [...xml.matchAll(/<w:r[\s>][\s\S]*?<\/w:r>/g)].map((m) => m[0]!);
    assertEquals(runs.length > 0, true);
    for (const run of runs) {
        if (!run.includes("<w:t")) continue;
        assertEquals(run.includes('w:ascii="Times New Roman"'), true, run.slice(0, 120));
    }
});

Deno.test("buildPlainTextDocx creates valid zip", () => {
    const bytes = buildPlainTextDocx("Đoạn văn bản thử.", "TIÊU ĐỀ");
    assertEquals(bytes[0], 0x50);
    assertEquals(bytes[1], 0x4b);
});
