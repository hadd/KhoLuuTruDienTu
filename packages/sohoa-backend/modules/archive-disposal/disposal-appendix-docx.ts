import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export type AppendixCatalogRow = {
    seqNumber: string;
    archiveNumber: string;
    boxNumber: string;
    volumeNumber: string;
    title: string;
    retentionPeriod: string;
    documentPageCount: string;
    disposalReasonLabel: string;
    notes: string;
};

function escapeXmlText(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function isTableOpenAt(documentXml: string, index: number): boolean {
    if (!documentXml.startsWith("<w:tbl", index)) return false;
    const next = documentXml[index + 6];
    return next === ">" || next === " " || next === "/";
}

function isRowOpenAt(documentXml: string, index: number): boolean {
    if (!documentXml.startsWith("<w:tr", index)) return false;
    const next = documentXml[index + 5];
    return next === ">" || next === " " || next === "/";
}

function extractBalancedBlock(
    documentXml: string,
    start: number,
    openPrefix: string,
    closeTag: string,
    isOpen: (xml: string, index: number) => boolean,
): { block: string; end: number } | null {
    if (!isOpen(documentXml, start)) return null;
    let depth = 1;
    let i = start + openPrefix.length;
    while (i < documentXml.length && depth > 0) {
        const nextOpen = documentXml.indexOf(openPrefix, i);
        const nextClose = documentXml.indexOf(closeTag, i);
        if (nextClose < 0) return null;
        if (nextOpen >= 0 && nextOpen < nextClose && isOpen(documentXml, nextOpen)) {
            depth++;
            i = nextOpen + openPrefix.length;
        } else {
            depth--;
            i = nextClose + closeTag.length;
        }
    }
    return depth === 0 ? { block: documentXml.slice(start, i), end: i } : null;
}

function extractTables(documentXml: string): string[] {
    const tables: string[] = [];
    let pos = 0;
    while (pos < documentXml.length) {
        const start = documentXml.indexOf("<w:tbl", pos);
        if (start < 0) break;
        if (!isTableOpenAt(documentXml, start)) {
            pos = start + 6;
            continue;
        }
        const extracted = extractBalancedBlock(documentXml, start, "<w:tbl", "</w:tbl>", isTableOpenAt);
        if (!extracted) break;
        tables.push(extracted.block);
        pos = extracted.end;
    }
    return tables;
}

function blockText(block: string): string {
    return [...block.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]!).join("");
}

/** TT-BNV sample bullet labels left in PL III template — data comes from {countsHeading}. */
const PL3_STATIC_COUNT_LABELS = [
    "- Tổng số tài liệu đưa ra xác định lại giá trị",
    "- Tổng số tài liệu giấy đưa ra chỉnh lý",
    "- Tài liệu giữ lại bảo quản",
    "- Tài liệu hết thời hạn lưu trữ, trùng lặp",
];

/** Thụt đầu dòng / bullet theo mẫu Word TT-BNV (twips: 1440 = 1 inch). */
const PL3_FIRST_LINE_INDENT = "425";
/** left = hanging → dòng xuống thẳng hàng với chữ sau «- » (~12pt). */
const PL3_BULLET_TEXT_INDENT = "360";
/** w:sz = half-points: 32 → 16pt (mục I, II); 24 → 12pt (mục 1,2,3 và nội dung). */
const PL3_SZ_MAJOR = "32";
const PL3_SZ_NORMAL = "24";

function isPl3MajorSectionLine(text: string): boolean {
    return /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s/.test(text.trim());
}

function classifyPl3Line(text: string): "majorSection" | "subheading" | "bullet" | "body" {
    if (isPl3MajorSectionLine(text)) return "majorSection";
    if (text.startsWith("- ")) return "bullet";
    if (/^\d+\.\s/.test(text)) return "subheading";
    return "body";
}

function pl3RunProperties(style: "majorSection" | "subheading" | "bullet" | "body"): string {
    const sz = style === "majorSection" ? PL3_SZ_MAJOR : PL3_SZ_NORMAL;
    const bold = style === "majorSection" || style === "subheading";
    return bold
        ? `<w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`
        : `<w:rPr><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
}

function buildPl3BulletParagraph(text: string): string {
    const body = text.startsWith("- ") ? text.slice(2) : text;
    const jc = '<w:jc w:val="both"/>';
    const ind =
        `<w:ind w:left="${PL3_BULLET_TEXT_INDENT}" w:hanging="${PL3_BULLET_TEXT_INDENT}"/>`;
    const rPr = pl3RunProperties("bullet");
    const escapedBody = escapeXmlText(body);
    return `<w:p><w:pPr>${jc}${ind}</w:pPr>` +
        `<w:r>${rPr}<w:t xml:space="preserve">- </w:t></w:r>` +
        `<w:r>${rPr}<w:t xml:space="preserve">${escapedBody}</w:t></w:r></w:p>`;
}

function buildPl3Paragraph(
    text: string,
    style: "majorSection" | "subheading" | "bullet" | "body",
): string {
    if (style === "bullet") return buildPl3BulletParagraph(text);

    const jc = '<w:jc w:val="both"/>';
    let ind = "";
    if (style === "body") {
        ind = `<w:ind w:firstLine="${PL3_FIRST_LINE_INDENT}"/>`;
    }
    const escaped = escapeXmlText(text);
    return `<w:p><w:pPr>${jc}${ind}</w:pPr><w:r>${pl3RunProperties(style)}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

function isPl3StaticCountsLabelParagraph(paraXml: string): boolean {
    const text = blockText(paraXml).replace(/\s+/g, " ").trim();
    return PL3_STATIC_COUNT_LABELS.includes(text);
}

function isCenterParagraph(paraXml: string): boolean {
    return /<w:jc w:val="center"/.test(paraXml);
}

function extractParagraphLines(paraXml: string): string[] {
    let inner = paraXml.replace(/^<w:p[^>]*>/, "").replace(/<\/w:p>$/, "");
    inner = inner.replace(/<w:pPr[\s\S]*?<\/w:pPr>/, "");
    const parts = inner.split(/(?:<w:br(?:\s[^>]*)?\/?>|<w:br(?:\s[^>]*)?>[\s\S]*?<\/w:br>)/);
    const lines: string[] = [];
    for (const part of parts) {
        const text = blockText(`<w:p>${part}</w:p>`).replace(/\s+/g, " ").trim();
        if (text) lines.push(text);
    }
    return lines;
}

function formatPl3Paragraph(paraXml: string): string {
    if (isCenterParagraph(paraXml)) return paraXml;

    const lines = extractParagraphLines(paraXml);
    if (lines.length === 0) return paraXml;
    if (lines.length === 1) {
        return buildPl3Paragraph(lines[0]!, classifyPl3Line(lines[0]!));
    }
    return lines.map((line) => buildPl3Paragraph(line, classifyPl3Line(line))).join("");
}

/** Chuẩn hóa layout PL III: bỏ dòng mẫu trùng, tách dòng, thụt lề, căn đều. */
export function normalizePl3DocumentXml(documentXml: string): string {
    const paragraphs = [...documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((m) => m[0]!);
    let out = documentXml;
    for (const para of paragraphs) {
        if (isPl3StaticCountsLabelParagraph(para)) {
            out = out.replace(para, "");
            continue;
        }
        const formatted = formatPl3Paragraph(para);
        if (formatted !== para) out = out.replace(para, formatted);
    }
    return out;
}

/** Sample TT-BNV catalog rows like "(1)", "(2)" — must not appear in exported PDF. */
export function isSampleCatalogRow(rowXml: string): boolean {
    const cells = [...rowXml.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((m) => m[0]!);
    if (cells.length === 0) {
        const t = blockText(rowXml).replace(/\s+/g, "").trim();
        return /^\(\d+\)$/.test(t);
    }
    const cellTexts = cells
        .map((cell) => blockText(cell).replace(/\s+/g, "").trim())
        .filter(Boolean);
    if (cellTexts.length === 0) return false;
    return cellTexts.every((t) => /^\(\d+\)$/.test(t));
}

function findCatalogTable(documentXml: string): string | null {
    const tables = extractTables(documentXml);
    for (const table of tables) {
        const text = blockText(table);
        if (/Bó số/i.test(text) && /Lý do hủy/i.test(text)) return table;
    }
    return tables[0] ?? null;
}

function extractTableRows(tableXml: string): string[] {
    const rows: string[] = [];
    let pos = 0;
    while (pos < tableXml.length) {
        const start = tableXml.indexOf("<w:tr", pos);
        if (start < 0) break;
        if (!isRowOpenAt(tableXml, start)) {
            pos = start + 5;
            continue;
        }
        const extracted = extractBalancedBlock(tableXml, start, "<w:tr", "</w:tr>", isRowOpenAt);
        if (!extracted) break;
        rows.push(extracted.block);
        pos = extracted.end;
    }
    return rows;
}

function setCellText(cellXml: string, value: string): string {
    const escaped = escapeXmlText(value);
    const tcOpen = cellXml.match(/^<w:tc[^>]*>/)?.[0] ?? "<w:tc>";
    const tcPr = cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/)?.[0] ?? "";
    const pPr = cellXml.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
    return `${tcOpen}${tcPr}<w:p>${pPr}<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p></w:tc>`;
}

function setRowCellTexts(rowXml: string, cells: string[]): string {
    const cellMatches = [...rowXml.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((m) => m[0]!);
    if (cellMatches.length === 0) return rowXml;
    const prefix = rowXml.slice(0, rowXml.indexOf("<w:tc"));
    const filledCells = cellMatches.map((cell, i) => setCellText(cell, cells[i] ?? ""));
    return `${prefix}${filledCells.join("")}</w:tr>`;
}

function resolveTemplateRowIndex(rows: string[]): number {
    if (rows.length <= 2) return -1;
    for (let i = 2; i < rows.length; i++) {
        if (isSampleCatalogRow(rows[i]!)) continue;
        const t = blockText(rows[i]!).replace(/\s+/g, "");
        if (t === "" || /^\.+$/.test(t)) return i;
    }
    for (let i = rows.length - 1; i >= 2; i--) {
        if (!isSampleCatalogRow(rows[i]!)) return i;
    }
    return rows.length - 1;
}

export function fillCatalogTableInDocumentXml(
    documentXml: string,
    rows: AppendixCatalogRow[],
): string {
    const table = findCatalogTable(documentXml);
    if (!table) {
        console.warn("[archive-disposal] Không tìm thấy bảng danh mục Phụ lục II trong document.xml");
        return documentXml;
    }

    const rowMatches = extractTableRows(table);
    if (rowMatches.length < 2) {
        console.warn("[archive-disposal] Bảng danh mục có quá ít hàng (< 2)");
        return documentXml;
    }

    const templateIdx = resolveTemplateRowIndex(rowMatches);
    if (templateIdx < 0) {
        console.warn("[archive-disposal] Không xác định được hàng mẫu trong bảng danh mục");
        return documentXml;
    }

    const headerRows = rowMatches.slice(0, templateIdx).filter((r) => !isSampleCatalogRow(r));
    const templateRow = rowMatches[templateIdx]!;
    const dataRows = rows.length > 0
        ? rows.map((row) =>
            setRowCellTexts(templateRow, [
                row.seqNumber,
                row.archiveNumber,
                row.title,
                row.retentionPeriod,
                row.documentPageCount,
                row.disposalReasonLabel,
                row.notes,
            ])
        )
        : [setRowCellTexts(templateRow, ["", "", "", "", ""])];

    const tblOpen = table.match(/^<w:tbl[^>]*>/)?.[0] ?? "<w:tbl>";
    const tblPr = table.match(/<w:tblPr[\s\S]*?<\/w:tblPr>/)?.[0] ?? "";
    const inner = `${tblPr}${[...headerRows, ...dataRows].join("")}`;
    const newTable = `${tblOpen}${inner}</w:tbl>`;

    return documentXml.replace(table, newTable);
}

export function renderDocxTemplate(
    templateBytes: Uint8Array,
    data: Record<string, string>,
    options?: { tableRows?: AppendixCatalogRow[]; normalizePl3?: boolean },
): Uint8Array {
    const zip = new PizZip(templateBytes);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
    });
    doc.render(data);
    let out = doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
    const outZip = new PizZip(out);
    let xml = outZip.file("word/document.xml")!.asText();
    if (options?.normalizePl3) {
        xml = normalizePl3DocumentXml(xml);
    }
    if (options?.tableRows) {
        xml = fillCatalogTableInDocumentXml(xml, options.tableRows);
    }
    if (options?.normalizePl3 || options?.tableRows) {
        outZip.file("word/document.xml", xml);
        out = outZip.generate({ type: "uint8array" }) as Uint8Array;
    }
    return out;
}

export async function loadAppendixTemplate(name: "phu-luc-ii-danh-muc.docx" | "phu-luc-iii-thuyet-minh.docx") {
    const url = new URL(`./templates/${name}`, import.meta.url);
    return await Deno.readFile(url);
}
