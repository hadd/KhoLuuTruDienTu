import { PDFDocument, rgb } from "pdf-lib";

import { embedWatermarkFont } from "../../libs/watermark/watermark-font.ts";
import type { DisposalCouncilEvaluationDecisionType } from "../../db/schemas/archive-disposal-constants.ts";

export type CouncilMinutesMemberEvaluation = {
    memberName: string;
    positionLabel: string;
    itemLabel: string;
    decision: DisposalCouncilEvaluationDecisionType | null;
    note: string;
};

export type CouncilMinutesOutcomeRow = {
    label: string;
    decision: DisposalCouncilEvaluationDecisionType | null;
    hasDissent: boolean;
    chairReason: string | null;
};

export type CouncilMinutesPdfInput = {
    title: string;
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: Date;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: CouncilMinutesOutcomeRow[];
    evaluations: CouncilMinutesMemberEvaluation[];
    summaryLine: string;
};

function decisionLabel(decision: DisposalCouncilEvaluationDecisionType | null): string {
    if (decision === "DESTROY") return "Đồng ý hủy";
    if (decision === "KEEP") return "Không hủy";
    return "Chưa kết luận";
}

export async function buildCouncilMinutesPdf(input: CouncilMinutesPdfInput): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await embedWatermarkFont(doc);
    const pageSize: [number, number] = [595.28, 841.89];
    let page = doc.addPage(pageSize);
    let y = pageSize[1] - 48;
    const margin = 48;
    const lineHeight = 14;
    const maxWidth = pageSize[0] - margin * 2;

    function wrapText(text: string, size: number): string[] {
        const words = text.replace(/\s+/g, " ").trim().split(" ");
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

    function drawParagraph(text: string, opts?: { bold?: boolean; size?: number }) {
        const size = opts?.size ?? (opts?.bold ? 12 : 11);
        for (const line of wrapText(text, size)) {
            if (y < margin + lineHeight) {
                page = doc.addPage(pageSize);
                y = pageSize[1] - margin;
            }
            page.drawText(line, {
                x: margin,
                y,
                size,
                font,
                color: rgb(0.1, 0.1, 0.1),
            });
            y -= opts?.bold ? lineHeight + 2 : lineHeight;
        }
    }

    drawParagraph(input.title, { bold: true, size: 13 });
    drawParagraph("");
    drawParagraph(`Mã Hội đồng: ${input.councilCode}`);
    drawParagraph(`Danh mục: ${input.catalogCode} — ${input.catalogName}`);
    drawParagraph(`Ngày họp: ${input.meetingDate.toISOString().slice(0, 10)}`);
    drawParagraph("");
    drawParagraph("Thành phần Hội đồng:", { bold: true });
    for (const member of input.members) {
        const absent = member.excusedAbsent ? " (vắng mặt có lý do)" : "";
        drawParagraph(`• ${member.fullName} — ${member.positionLabel}${absent}`);
    }
    drawParagraph("");
    drawParagraph(input.summaryLine);
    drawParagraph("");
    drawParagraph("Kết luận theo từng hồ sơ/tài liệu:", { bold: true });
    for (const row of input.outcomes) {
        const dissent = row.hasDissent ? " — có ý kiến khác biệt" : "";
        drawParagraph(`• ${row.label}: ${decisionLabel(row.decision)}${dissent}`);
        if (row.chairReason?.trim()) {
            drawParagraph(`  Lý do Chủ tịch: ${row.chairReason.trim()}`);
        }
    }
    drawParagraph("");
    drawParagraph("Ý kiến thành viên:", { bold: true });
    for (const ev of input.evaluations) {
        drawParagraph(
            `• ${ev.memberName} (${ev.positionLabel}) — ${ev.itemLabel}: ${decisionLabel(ev.decision)}. ${ev.note}`,
        );
    }

    return await doc.save();
}

export async function buildDestructionMinutesPdf(
    input: CouncilMinutesPdfInput & { destructionSummary: string },
): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await embedWatermarkFont(doc);
    const pageSize: [number, number] = [595.28, 841.89];
    let page = doc.addPage(pageSize);
    let y = pageSize[1] - 48;
    const margin = 48;
    const lineHeight = 14;
    const maxWidth = pageSize[0] - margin * 2;

    function wrapText(text: string, size: number): string[] {
        const words = text.replace(/\s+/g, " ").trim().split(" ");
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

    function drawParagraph(text: string, opts?: { bold?: boolean; size?: number }) {
        const size = opts?.size ?? (opts?.bold ? 12 : 11);
        for (const line of wrapText(text, size)) {
            if (y < margin + lineHeight) {
                page = doc.addPage(pageSize);
                y = pageSize[1] - margin;
            }
            page.drawText(line, {
                x: margin,
                y,
                size,
                font,
                color: rgb(0.1, 0.1, 0.1),
            });
            y -= opts?.bold ? lineHeight + 2 : lineHeight;
        }
    }

    drawParagraph("BIÊN BẢN Về việc hủy hồ sơ, tài liệu hết giá trị", { bold: true, size: 13 });
    drawParagraph("");
    drawParagraph(`Mã Hội đồng: ${input.councilCode}`);
    drawParagraph(`Danh mục: ${input.catalogCode} — ${input.catalogName}`);
    drawParagraph(`Ngày: ${input.meetingDate.toISOString().slice(0, 10)}`);
    drawParagraph("");
    drawParagraph(input.destructionSummary);
    drawParagraph("");
    drawParagraph("Danh sách hồ sơ/tài liệu đề nghị hủy:", { bold: true });
    for (const row of input.outcomes) {
        if (row.decision !== "DESTROY") continue;
        drawParagraph(`• ${row.label}`);
    }
    drawParagraph("");
    drawParagraph("Thành phần tham dự:", { bold: true });
    for (const member of input.members.filter((m) => !m.excusedAbsent)) {
        drawParagraph(`• ${member.fullName} — ${member.positionLabel}`);
    }

    return await doc.save();
}
