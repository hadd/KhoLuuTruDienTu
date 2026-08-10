import { PDFDocument, rgb } from "pdf-lib";

import { embedWatermarkFont } from "../../libs/watermark/watermark-font.ts";
import type { DisposalCouncilEvaluationDecisionType } from "../../db/schemas/archive-disposal-constants.ts";

export type CouncilDecisionPdfRow = {
    label: string;
    decision: DisposalCouncilEvaluationDecisionType | null;
    hasDissent: boolean;
};

function decisionLabel(decision: DisposalCouncilEvaluationDecisionType | null): string {
    if (decision === "DESTROY") return "Hủy";
    if (decision === "KEEP") return "Không hủy";
    return "Chưa kết luận";
}

export async function buildCouncilDecisionPdf(input: {
    councilCode: string;
    catalogName: string;
    catalogCode: string;
    publishedAt: Date;
    rows: CouncilDecisionPdfRow[];
}): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await embedWatermarkFont(doc);

    const pageSize: [number, number] = [595.28, 841.89];
    let page = doc.addPage(pageSize);
    let y = pageSize[1] - 48;
    const margin = 48;
    const lineHeight = 14;

    function drawLine(text: string, bold = false) {
        if (y < margin + lineHeight) {
            page = doc.addPage(pageSize);
            y = pageSize[1] - margin;
        }
        const size = bold ? 12 : 11;
        page.drawText(text, {
            x: margin,
            y,
            size,
            font,
            color: rgb(0.1, 0.1, 0.1),
        });
        y -= bold ? lineHeight + 2 : lineHeight;
    }

    drawLine("QUYẾT ĐỊNH HỘI ĐỒNG XÉT HỦY", true);
    drawLine("");
    drawLine(`Mã Hội đồng: ${input.councilCode}`);
    drawLine(`Danh mục: ${input.catalogCode} — ${input.catalogName}`);
    drawLine(`Ngày xuất bản: ${input.publishedAt.toISOString().slice(0, 10)}`);
    drawLine("");
    drawLine("Kết luận theo đơn vị đánh giá:", true);

    for (const row of input.rows) {
        const suffix = row.hasDissent ? " (có ý kiến khác biệt)" : "";
        drawLine(`• ${row.label}: ${decisionLabel(row.decision)}${suffix}`);
    }

    return await doc.save();
}
