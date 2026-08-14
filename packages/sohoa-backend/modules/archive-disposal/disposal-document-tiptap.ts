import type { DisposalAppraisalDocumentTypeType } from "../../db/schemas/archive-disposal-constants.ts";
import { DisposalAppraisalDocumentType } from "../../db/schemas/archive-disposal-constants.ts";

export type TipTapMark = { type: string; attrs?: Record<string, unknown> };
export type TipTapNode = {
    type: string;
    attrs?: Record<string, unknown>;
    content?: TipTapNode[];
    text?: string;
    marks?: TipTapMark[];
};

export type TipTapDocument = {
    type: "doc";
    content: TipTapNode[];
};

export const ASSET_DOCX_TEMPLATES = {
    MINUTES_COUNCIL: "MAU 1-PHU LUC XV-755-QD-BGDDT.docx",
    MINUTES_DESTRUCTION: "PHU LUC 06-QD-193-QD-TANDTC.docx",
    PL3_MASTER: "Phu luc kem Thong tu 06.2025.TT-BNV.docx",
} as const;

export function emptyTipTapDocument(): TipTapDocument {
    return { type: "doc", content: [{ type: "paragraph" }] };
}

function textNode(text: string, marks?: TipTapMark[]): TipTapNode {
    return marks?.length ? { type: "text", text, marks } : { type: "text", text };
}

function paragraph(
    text: string,
    opts?: { align?: string; bold?: boolean },
): TipTapNode {
    const marks = opts?.bold ? [{ type: "bold" }] : undefined;
    return {
        type: "paragraph",
        attrs: opts?.align ? { textAlign: opts.align } : undefined,
        content: text ? [textNode(text, marks)] : undefined,
    };
}

function heading(text: string, level = 2, align = "center"): TipTapNode {
    return {
        type: "heading",
        attrs: { level, textAlign: align },
        content: [textNode(text, [{ type: "bold" }])],
    };
}

function bulletList(items: string[]): TipTapNode {
    return {
        type: "bulletList",
        content: items.map((item) => ({
            type: "listItem",
            content: [paragraph(item)],
        })),
    };
}

export function documentTypeToDraftKey(
    documentType: DisposalAppraisalDocumentTypeType,
): "PL3" | "MINUTES_COUNCIL" | "MINUTES_DESTRUCTION" | null {
    if (documentType === DisposalAppraisalDocumentType.PL3) return "PL3";
    if (documentType === DisposalAppraisalDocumentType.MINUTES_COUNCIL) return "MINUTES_COUNCIL";
    if (documentType === DisposalAppraisalDocumentType.MINUTES_DESTRUCTION) {
        return "MINUTES_DESTRUCTION";
    }
    return null;
}

export function buildCouncilMinutesTipTap(input: {
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: string;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: Array<{ label: string; decision: string; hasDissent: boolean; chairReason: string | null }>;
    evaluations: Array<{ memberName: string; positionLabel: string; itemLabel: string; decision: string; note: string }>;
    summaryLine: string;
}): TipTapDocument {
    /** @deprecated Prefer buildCouncilMinutesTipTapFromAsset (form từ DOCX assets). Kept for unit tests. */
    const nodes: TipTapNode[] = [
        heading("BIÊN BẢN Họp Hội đồng xét hủy tài liệu lưu trữ"),
        paragraph(""),
        paragraph(`Mã Hội đồng: ${input.councilCode}`),
        paragraph(`Danh mục: ${input.catalogCode} — ${input.catalogName}`),
        paragraph(`Ngày họp: ${input.meetingDate}`),
        paragraph(""),
        paragraph("Thành phần Hội đồng:", { bold: true }),
        bulletList(input.members.map((m) => {
            const absent = m.excusedAbsent ? " (vắng mặt có lý do)" : "";
            return `${m.fullName} — ${m.positionLabel}${absent}`;
        })),
        paragraph(""),
        paragraph(input.summaryLine),
        paragraph(""),
        paragraph("Kết luận theo từng hồ sơ/tài liệu:", { bold: true }),
    ];

    for (const row of input.outcomes) {
        const dissent = row.hasDissent ? " — có ý kiến khác biệt" : "";
        nodes.push(paragraph(`• ${row.label}: ${row.decision}${dissent}`));
        if (row.chairReason?.trim()) {
            nodes.push(paragraph(`  Lý do Chủ tịch: ${row.chairReason.trim()}`));
        }
    }

    nodes.push(paragraph(""), paragraph("Ý kiến thành viên:", { bold: true }));
    for (const ev of input.evaluations) {
        nodes.push(paragraph(
            `• ${ev.memberName} (${ev.positionLabel}) — ${ev.itemLabel}: ${ev.decision}. ${ev.note}`,
        ));
    }

    return { type: "doc", content: nodes };
}

export function buildDestructionMinutesTipTap(input: {
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: string;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: Array<{ label: string; decision: string }>;
    destructionSummary: string;
}): TipTapDocument {
    const nodes: TipTapNode[] = [
        heading("BIÊN BẢN Về việc hủy hồ sơ, tài liệu hết giá trị"),
        paragraph(""),
        paragraph(`Mã Hội đồng: ${input.councilCode}`),
        paragraph(`Danh mục: ${input.catalogCode} — ${input.catalogName}`),
        paragraph(`Ngày: ${input.meetingDate}`),
        paragraph(""),
        paragraph(input.destructionSummary),
        paragraph(""),
        paragraph("Danh sách hồ sơ/tài liệu đề nghị hủy:", { bold: true }),
        bulletList(input.outcomes.filter((o) => o.decision === "Đồng ý hủy").map((o) => o.label)),
        paragraph(""),
        paragraph("Thành phần tham dự:", { bold: true }),
        bulletList(
            input.members.filter((m) => !m.excusedAbsent).map((m) =>
                `${m.fullName} — ${m.positionLabel}`
            ),
        ),
    ];
    return { type: "doc", content: nodes };
}

export function buildPl3TipTap(input: {
    fondName: string;
    formationHeading: string;
    countsHeading: string;
    timeRangeText: string;
    expiredGroupBlock: string;
    duplicateGroupBlock: string;
    otherGroupBlock: string;
}): TipTapDocument {
    const section = (title: string, body: string) => [
        paragraph(title, { bold: true }),
        ...body.split("\n").filter(Boolean).map((line) => paragraph(line)),
        paragraph(""),
    ];

    const nodes: TipTapNode[] = [
        heading("BẢN THUYẾT MINH TÀI LIỆU"),
        paragraph(`Phông: ${input.fondName}`, { align: "center" }),
        paragraph(""),
        ...section("1. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp", input.formationHeading),
        ...section("2. Số lượng tài liệu", input.countsHeading),
        paragraph(input.timeRangeText),
        paragraph(""),
        ...section("4. Nhóm tài liệu hết thời hạn lưu trữ", input.expiredGroupBlock),
        ...section("5. Nhóm tài liệu trùng lặp", input.duplicateGroupBlock),
        ...section("6. Các nhóm tài liệu khác (nếu có)", input.otherGroupBlock),
    ];

    return { type: "doc", content: nodes };
}

export function tipTapDocumentToPlainText(doc: TipTapDocument): string {
    const lines: string[] = [];
    function walk(node: TipTapNode) {
        if (node.type === "text" && node.text) {
            lines.push(node.text);
            return;
        }
        if (node.type === "paragraph" || node.type === "heading") {
            const start = lines.length;
            for (const child of node.content ?? []) {
                if (child.type === "hardBreak") {
                    lines.push("\n");
                    continue;
                }
                walk(child);
            }
            lines.push("\n");
            if (node.type === "heading" && lines.length === start + 1) lines.push("\n");
            return;
        }
        if (node.type === "bulletList" || node.type === "orderedList") {
            for (const item of node.content ?? []) {
                if (item.type === "listItem") {
                    lines.push("• ");
                    for (const child of item.content ?? []) walk(child);
                }
            }
            lines.push("\n");
            return;
        }
        if (node.type === "table") {
            for (const row of node.content ?? []) {
                for (const cell of row.content ?? []) {
                    for (const child of cell.content ?? []) walk(child);
                    lines.push("\n");
                }
            }
            return;
        }
        for (const child of node.content ?? []) walk(child);
    }
    for (const node of doc.content) walk(node);
    return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}
