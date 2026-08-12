import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

import { embedWatermarkFont } from "../../libs/watermark/watermark-font.ts";
import type { AppendixCatalogRow } from "./disposal-appendix-docx.ts";
import { DISPOSAL_APPENDIX_CIRCULAR_LABEL } from "./disposal-appendix-metadata-keys.ts";

const PAGE_SIZE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const LINE = 14;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return [""];
    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) {
            current = test;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
}

type Writer = {
    draw: (text: string, bold?: boolean) => void;
};

function createWriter(doc: PDFDocument, font: PDFFont): Writer {
    let page = doc.addPage(PAGE_SIZE);
    let y = PAGE_SIZE[1] - MARGIN;
    const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

    function draw(text: string, bold = false) {
        const size = bold ? 12 : 11;
        const lines = wrapText(text, font, size, maxWidth);
        for (const line of lines) {
            if (y < MARGIN + LINE) {
                page = doc.addPage(PAGE_SIZE);
                y = PAGE_SIZE[1] - MARGIN;
            }
            page.drawText(line, {
                x: MARGIN,
                y,
                size,
                font,
                color: rgb(0.1, 0.1, 0.1),
            });
            y -= bold ? LINE + 2 : LINE;
        }
    }

    return { draw };
}

export async function buildPhuLucIIPdfFallback(input: {
    fondName: string;
    circularLabel?: string;
    rows: AppendixCatalogRow[];
}): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await embedWatermarkFont(doc);
    const w = createWriter(doc, font);
    const circular = input.circularLabel ?? DISPOSAL_APPENDIX_CIRCULAR_LABEL;

    w.draw(`(Kèm theo Thông tư số ${circular} của Bộ trưởng Bộ Nội vụ)`);
    w.draw("");
    w.draw("DANH MỤC TÀI LIỆU HẾT THỜI HẠN LƯU TRỮ, TRÙNG LẶP", true);
    w.draw(`Phông (khối): ${input.fondName}`);
    w.draw("");
    w.draw("Bó số | Tập số | Tiêu đề / Số hồ sơ | Lý do hủy | Ghi chú", true);

    for (const row of input.rows) {
        w.draw(
            [
                row.boxNumber || "—",
                row.volumeNumber || "—",
                row.title,
                row.disposalReasonLabel,
                row.notes || "—",
            ].join(" | "),
        );
    }

    return await doc.save();
}

export async function buildPhuLucIIIPdfFallback(input: {
    fondName: string;
    circularLabel?: string;
    formationText: string;
    countsDetail: string;
    timeRangeText: string;
    expiredGroupSummary: string;
    duplicateGroupSummary: string;
    otherGroupSummary: string;
}): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await embedWatermarkFont(doc);
    const w = createWriter(doc, font);
    const circular = input.circularLabel ?? DISPOSAL_APPENDIX_CIRCULAR_LABEL;

    w.draw(`(Kèm theo Thông tư số ${circular} của Bộ trưởng Bộ Nội vụ)`);
    w.draw("");
    w.draw("BẢN THUYẾT MINH TÀI LIỆU HẾT THỜI HẠN LƯU TRỮ, TRÙNG LẶP", true);
    w.draw(`Phông (khối): ${input.fondName}`);
    w.draw("");
    w.draw("I. Tóm tắt tình hình khối tài liệu hết thời hạn lưu trữ, trùng lặp", true);
    w.draw(`1. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp`);
    w.draw(input.formationText);
    w.draw("2. Số lượng tài liệu:");
    for (const line of input.countsDetail.split("\n")) w.draw(line);
    w.draw(input.timeRangeText);
    w.draw("");
    w.draw("II. Tóm tắt thành phần và nội dung chủ yếu", true);
    w.draw("1. Nhóm tài liệu hết thời hạn lưu trữ:");
    w.draw(input.expiredGroupSummary);
    w.draw("2. Nhóm tài liệu trùng lặp:");
    w.draw(input.duplicateGroupSummary);
    w.draw(input.otherGroupSummary);

    return await doc.save();
}
