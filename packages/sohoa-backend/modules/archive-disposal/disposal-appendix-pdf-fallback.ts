import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

import { embedWatermarkFont } from "../../libs/watermark/watermark-font.ts";
import type { AppendixCatalogRow } from "./disposal-appendix-docx.ts";
import { DISPOSAL_APPENDIX_CIRCULAR_LABEL } from "./disposal-appendix-metadata-keys.ts";

const PAGE_SIZE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const LINE = 14;
const FIRST_LINE_INDENT = 24;

function wrapWords(words: string[], font: PDFFont, size: number, maxWidth: number): string[] {
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

function drawBulletParagraph(
    page: ReturnType<PDFDocument["addPage"]>,
    y: number,
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number,
): number {
    const prefix = "- ";
    const body = text.startsWith(prefix) ? text.slice(prefix.length) : text;
    const prefixWidth = font.widthOfTextAtSize(prefix, size);
    const textX = MARGIN + prefixWidth;
    const wrapWidth = maxWidth - prefixWidth;
    const lines = wrapWords(body.split(/\s+/), font, size, wrapWidth);

    for (let i = 0; i < lines.length; i++) {
        if (i === 0) {
            page.drawText(prefix, { x: MARGIN, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        }
        page.drawText(lines[i]!, { x: textX, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= LINE;
    }
    return y;
}

type Writer = {
    draw: (
        text: string,
        opts?: { bold?: boolean; size?: number; indent?: "body" | "bullet" },
    ) => void;
};

function createWriter(doc: PDFDocument, font: PDFFont): Writer {
    let page = doc.addPage(PAGE_SIZE);
    let y = PAGE_SIZE[1] - MARGIN;
    const maxWidth = PAGE_SIZE[0] - MARGIN * 2;

    function draw(
        text: string,
        opts?: { bold?: boolean; size?: number; indent?: "body" | "bullet" },
    ) {
        const size = opts?.size ?? (opts?.bold ? 12 : 11);
        const indent = opts?.indent;
        const normalized = text.replace(/\s+/g, " ").trim();
        if (!normalized) {
            y -= LINE;
            return;
        }

        if (indent === "bullet" && normalized.startsWith("- ")) {
            if (y < MARGIN + LINE) {
                page = doc.addPage(PAGE_SIZE);
                y = PAGE_SIZE[1] - MARGIN;
            }
            y = drawBulletParagraph(page, y, normalized, font, size, maxWidth);
            return;
        }

        const x = MARGIN;
        const wrapWidth = indent === "body" ? maxWidth - FIRST_LINE_INDENT : maxWidth;
        const lines = wrapWords(normalized.split(/\s+/), font, size, wrapWidth);

        for (let i = 0; i < lines.length; i++) {
            if (y < MARGIN + LINE) {
                page = doc.addPage(PAGE_SIZE);
                y = PAGE_SIZE[1] - MARGIN;
            }
            const lineX = indent === "body" && i === 0 ? x + FIRST_LINE_INDENT : x;
            page.drawText(lines[i]!, {
                x: lineX,
                y,
                size,
                font,
                color: rgb(0.1, 0.1, 0.1),
            });
            y -= size >= 14 ? LINE + 3 : opts?.bold ? LINE + 2 : LINE;
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
    w.draw("DANH MỤC TÀI LIỆU HẾT THỜI HẠN LƯU TRỮ, TRÙNG LẶP", { bold: true, size: 12 });
    w.draw(`Phông (khối): ${input.fondName}`);
    w.draw("");
    w.draw("Bó số | Tập số | Tiêu đề / Số hồ sơ | Lý do hủy | Ghi chú", { bold: true, size: 12 });

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
    w.draw("BẢN THUYẾT MINH TÀI LIỆU HẾT THỜI HẠN LƯU TRỮ, TRÙNG LẶP", { bold: true, size: 12 });
    w.draw(`Phông (khối): ${input.fondName}`, { bold: true, size: 12 });
    w.draw("");
    w.draw("I. Tóm tắt tình hình khối tài liệu hết thời hạn lưu trữ, trùng lặp", {
        bold: true,
        size: 14,
    });
    w.draw(`1. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp`, { bold: true, size: 12 });
    for (const line of input.formationText.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        w.draw(trimmed, { indent: trimmed.startsWith("- ") ? "bullet" : "body" });
    }
    w.draw("2. Số lượng tài liệu:", { bold: true, size: 12 });
    for (const line of input.countsDetail.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        w.draw(trimmed, { indent: trimmed.startsWith("- ") ? "bullet" : "body" });
    }
    w.draw(input.timeRangeText, {
        bold: /^\d+\./.test(input.timeRangeText.trim()),
        size: /^\d+\./.test(input.timeRangeText.trim()) ? 12 : undefined,
        indent: /^\d+\./.test(input.timeRangeText.trim()) ? undefined : "body",
    });
    w.draw("");
    w.draw("II. Tóm tắt thành phần và nội dung chủ yếu", { bold: true, size: 14 });
    for (const line of input.expiredGroupSummary.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const isSub = /^\d+\.\s/.test(trimmed);
        w.draw(trimmed, {
            bold: isSub,
            size: isSub ? 12 : undefined,
            indent: trimmed.startsWith("- ") ? "bullet" : isSub ? undefined : "body",
        });
    }
    w.draw("2. Nhóm tài liệu trùng lặp:", { bold: true, size: 12 });
    w.draw(input.duplicateGroupSummary, { indent: "body" });
    for (const line of input.otherGroupSummary.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const isSub = /^\d+\.\s/.test(trimmed);
        w.draw(trimmed, {
            bold: isSub,
            size: isSub ? 12 : undefined,
            indent: trimmed.startsWith("- ") ? "bullet" : isSub ? undefined : "body",
        });
    }

    return await doc.save();
}
