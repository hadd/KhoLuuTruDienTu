import PizZip from "pizzip";

import type { AssetDocxTemplateKey } from "./disposal-asset-docx.ts";
import { fillDocxBlankRuns, loadAssetDocxTemplate } from "./disposal-asset-docx.ts";
import type { TipTapDocument, TipTapMark, TipTapNode } from "./disposal-document-tiptap.ts";

export type DocxParagraph = {
    text: string;
    align?: string;
    bold: boolean;
    underline: boolean;
    italic?: boolean;
    fontSize?: string;
};

export type DocxTable = {
    rows: DocxParagraph[][][];
    borderless?: boolean;
    colWidths?: number[];
};

export type DocxBlock =
    | { type: "paragraph"; paragraph: DocxParagraph }
    | { type: "table"; table: DocxTable };

function isTableOpenAt(xml: string, index: number): boolean {
    if (!xml.startsWith("<w:tbl", index)) return false;
    const next = xml[index + 6];
    return next === ">" || next === " " || next === "/" || next === "\n" || next === "\r";
}

function isRowOpenAt(xml: string, index: number): boolean {
    if (!xml.startsWith("<w:tr", index)) return false;
    const next = xml[index + 5];
    return next === ">" || next === " " || next === "/" || next === "\n" || next === "\r";
}

function isCellOpenAt(xml: string, index: number): boolean {
    if (!xml.startsWith("<w:tc", index)) return false;
    const next = xml[index + 5];
    return next === ">" || next === " " || next === "/" || next === "\n" || next === "\r";
}

function isParagraphOpenAt(xml: string, index: number): boolean {
    if (!xml.startsWith("<w:p", index)) return false;
    const next = xml[index + 4];
    return next === ">" || next === " " || next === "/" || next === "\n" || next === "\r";
}

function extractBalancedBlock(
    xml: string,
    start: number,
    openPrefix: string,
    closeTag: string,
    isOpen: (source: string, index: number) => boolean,
): { block: string; end: number } | null {
    if (!isOpen(xml, start)) return null;
    let depth = 1;
    let i = start + openPrefix.length;
    while (i < xml.length && depth > 0) {
        const nextOpen = xml.indexOf(openPrefix, i);
        const nextClose = xml.indexOf(closeTag, i);
        if (nextClose < 0) return null;
        if (nextOpen >= 0 && nextOpen < nextClose && isOpen(xml, nextOpen)) {
            depth++;
            i = nextOpen + openPrefix.length;
        } else {
            depth--;
            i = nextClose + closeTag.length;
        }
    }
    return depth === 0 ? { block: xml.slice(start, i), end: i } : null;
}

function decodeXmlText(value: string): string {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function escapeXmlText(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function mapWordAlign(jc?: string): string | undefined {
    if (!jc) return undefined;
    if (jc === "both") return "justify";
    if (jc === "center" || jc === "right" || jc === "left") return jc;
    return undefined;
}

function mapTipTapAlign(align?: string): string | undefined {
    if (!align || align === "left") return undefined;
    if (align === "justify") return "both";
    if (align === "center" || align === "right") return align;
    return undefined;
}

export function parseParagraphXml(block: string): DocxParagraph {
    const parts: string[] = [];
    const tokenRe = /<w:t[^>]*>([^<]*)<\/w:t>|<w:br\b[^>]*\/?>|<w:tab\b[^>]*\/?>/g;
    for (const match of block.matchAll(tokenRe)) {
        if (match[1] !== undefined) {
            parts.push(decodeXmlText(match[1]));
        } else if (match[0].startsWith("<w:tab")) {
            parts.push("\t");
        } else {
            parts.push("\n");
        }
    }
    const text = parts.join("");
    const jc = block.match(/<w:jc\s+w:val="([^"]+)"/)?.[1];
    const bold = /<w:b(?:\s[^>]*)?\s*\/>/.test(block) || /<w:b\s+w:val="(?:true|1)"/.test(block);
    const underline = /<w:u(?:\s[^/]*)?\s*\/>/.test(block) && !/<w:u\s+w:val="none"/.test(block);
    const italic = /<w:i(?:\s[^>]*)?\s*\/>/.test(block) || /<w:i\s+w:val="(?:true|1)"/.test(block);
    const sz = block.match(/<w:sz\s+w:val="(\d+)"/)?.[1];
    return {
        text,
        align: mapWordAlign(jc),
        bold,
        underline,
        italic,
        fontSize: sz ? `${Number(sz) / 2}pt` : undefined,
    };
}

function parseCellXml(cellXml: string): DocxParagraph[] {
    const paragraphs: DocxParagraph[] = [];
    let pos = 0;
    while (pos < cellXml.length) {
        const start = cellXml.indexOf("<w:p", pos);
        if (start < 0) break;
        if (!isParagraphOpenAt(cellXml, start)) {
            pos = start + 4;
            continue;
        }
        const extracted = extractBalancedBlock(cellXml, start, "<w:p", "</w:p>", isParagraphOpenAt);
        if (!extracted) break;
        paragraphs.push(parseParagraphXml(extracted.block));
        pos = extracted.end;
    }
    return paragraphs.length > 0 ? paragraphs : [{ text: "", bold: false, underline: false }];
}

function parseTableColWidths(tableXml: string): number[] {
    const gridHead = tableXml.split("<w:tblGridChange")[0] ?? tableXml;
    return [...gridHead.matchAll(/<w:gridCol\s+w:w="([\d.]+)"/g)]
        .map((match) => Math.round(Number(match[1])))
        .filter((width) => width > 0);
}

function isBorderlessTableXml(tableXml: string): boolean {
    const borders = tableXml.match(/<w:tblBorders[\s\S]*?<\/w:tblBorders>/)?.[0] ?? "";
    if (!borders) return false;
    return !/<w:(?:top|left|bottom|right|insideH|insideV)\s+w:val="(?:single|double|dotted|dashed|thick)/.test(borders);
}

function parseTableXml(tableXml: string): DocxTable {
    const rows: DocxParagraph[][][] = [];
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
        const cells: DocxParagraph[][] = [];
        let cellPos = 0;
        const rowXml = extracted.block;
        while (cellPos < rowXml.length) {
            const cellStart = rowXml.indexOf("<w:tc", cellPos);
            if (cellStart < 0) break;
            if (!isCellOpenAt(rowXml, cellStart)) {
                cellPos = cellStart + 5;
                continue;
            }
            const cell = extractBalancedBlock(rowXml, cellStart, "<w:tc", "</w:tc>", isCellOpenAt);
            if (!cell) break;
            cells.push(parseCellXml(cell.block));
            cellPos = cell.end;
        }
        if (cells.length > 0) rows.push(cells);
        pos = extracted.end;
    }
    return {
        rows,
        borderless: isBorderlessTableXml(tableXml),
        colWidths: parseTableColWidths(tableXml),
    };
}

function bodyInnerXml(documentXml: string): string {
    const bodyOpen = documentXml.search(/<w:body[\s>]/);
    if (bodyOpen < 0) return documentXml;
    const openEnd = documentXml.indexOf(">", bodyOpen);
    const bodyClose = documentXml.lastIndexOf("</w:body>");
    if (openEnd < 0 || bodyClose < 0) return documentXml;
    return documentXml.slice(openEnd + 1, bodyClose);
}

/** Parse DOCX body as ordered paragraph + table blocks. Keeps empty paragraphs; does not flatten cells. */
export function parseDocxBlocks(docxBytes: Uint8Array): DocxBlock[] {
    const zip = new PizZip(docxBytes);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const body = bodyInnerXml(xml);
    const blocks: DocxBlock[] = [];
    let pos = 0;
    while (pos < body.length) {
        const pStart = body.indexOf("<w:p", pos);
        const tblStart = body.indexOf("<w:tbl", pos);
        const sectStart = body.indexOf("<w:sectPr", pos);

        const candidates: Array<{ kind: "p" | "tbl"; index: number }> = [];
        if (pStart >= 0 && isParagraphOpenAt(body, pStart) && (sectStart < 0 || pStart < sectStart)) {
            candidates.push({ kind: "p", index: pStart });
        }
        if (tblStart >= 0 && isTableOpenAt(body, tblStart) && (sectStart < 0 || tblStart < sectStart)) {
            candidates.push({ kind: "tbl", index: tblStart });
        }
        if (candidates.length === 0) break;

        candidates.sort((a, b) => a.index - b.index);
        const next = candidates[0]!;
        if (next.kind === "tbl") {
            const extracted = extractBalancedBlock(body, next.index, "<w:tbl", "</w:tbl>", isTableOpenAt);
            if (!extracted) break;
            blocks.push({ type: "table", table: parseTableXml(extracted.block) });
            pos = extracted.end;
            continue;
        }
        const extracted = extractBalancedBlock(body, next.index, "<w:p", "</w:p>", isParagraphOpenAt);
        if (!extracted) break;
        blocks.push({ type: "paragraph", paragraph: parseParagraphXml(extracted.block) });
        pos = extracted.end;
    }
    return blocks;
}

export async function loadAssetDocxBlocks(key: AssetDocxTemplateKey): Promise<DocxBlock[]> {
    const bytes = await loadAssetDocxTemplate(key);
    return parseDocxBlocks(bytes);
}

function paragraphToTipTap(
    paragraph: DocxParagraph,
    transformText?: (text: string) => string,
): TipTapNode {
    const text = transformText ? transformText(paragraph.text) : paragraph.text;
    const marks: TipTapMark[] = [];
    if (paragraph.bold) marks.push({ type: "bold" });
    if (paragraph.italic) marks.push({ type: "italic" });
    if (paragraph.underline) marks.push({ type: "underline" });
    if (paragraph.fontSize) marks.push({ type: "textStyle", attrs: { fontSize: paragraph.fontSize } });
    const node: TipTapNode = {
        type: "paragraph",
        attrs: paragraph.align ? { textAlign: paragraph.align } : { textAlign: "left" },
    };
    if (!text) return node;
    const lines = text.split("\n");
    const content: TipTapNode[] = [];
    lines.forEach((line, i) => {
        if (line) {
            content.push(marks.length ? { type: "text", text: line, marks } : { type: "text", text: line });
        }
        if (i < lines.length - 1) content.push({ type: "hardBreak" });
    });
    if (content.length) node.content = content;
    return node;
}

export function docxBlocksToTipTap(
    blocks: DocxBlock[],
    transformText?: (text: string) => string,
): TipTapDocument {
    const content: TipTapNode[] = [];
    for (const block of blocks) {
        if (block.type === "paragraph") {
            content.push(paragraphToTipTap(block.paragraph, transformText));
            continue;
        }
        content.push({
            type: "table",
            attrs: {
                ...(block.table.borderless ? { borderless: true, borderVisible: false } : {}),
            },
            content: block.table.rows.map((row) => ({
                type: "tableRow",
                content: row.map((cellParas, cellIndex) => {
                    const twips = block.table.colWidths?.[cellIndex];
                    const colwidth = twips && twips > 0 ? [Math.round(twips / 15)] : undefined;
                    return {
                        type: "tableCell",
                        attrs: colwidth ? { colwidth } : undefined,
                        content: cellParas.map((p) => paragraphToTipTap(p, transformText)),
                    };
                }),
            })),
        });
    }
    return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

export function fillDocxBlocks(
    blocks: DocxBlock[],
    transformText: (text: string) => string,
): TipTapDocument {
    return docxBlocksToTipTap(blocks, (text) => {
        if (!text) return text;
        return transformText(text);
    });
}

function collectInline(node: TipTapNode): {
    text: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    fontFamily?: string;
    fontSize?: string;
} {
    if (node.type === "text") {
        const textStyle = node.marks?.find((m) => m.type === "textStyle")?.attrs ?? {};
        return {
            text: node.text ?? "",
            bold: Boolean(node.marks?.some((m) => m.type === "bold")),
            italic: Boolean(node.marks?.some((m) => m.type === "italic")),
            underline: Boolean(node.marks?.some((m) => m.type === "underline")),
            fontFamily: typeof textStyle.fontFamily === "string" ? textStyle.fontFamily : undefined,
            fontSize: typeof textStyle.fontSize === "string" ? textStyle.fontSize : undefined,
        };
    }
    let text = "";
    let bold = false;
    let italic = false;
    let underline = false;
    let fontFamily: string | undefined;
    let fontSize: string | undefined;
    for (const child of node.content ?? []) {
        const inner = collectInline(child);
        text += inner.text;
        bold = bold || inner.bold;
        italic = italic || inner.italic;
        underline = underline || inner.underline;
        fontFamily = fontFamily ?? inner.fontFamily;
        fontSize = fontSize ?? inner.fontSize;
    }
    return { text, bold, italic, underline, fontFamily, fontSize };
}

const DEFAULT_WORD_FONT = "Times New Roman";
const DEFAULT_WORD_SZ = "26";

function ptToWordHalfPoints(fontSize?: string): string {
    if (!fontSize) return DEFAULT_WORD_SZ;
    const ptMatch = fontSize.match(/^([\d.]+)\s*pt$/i);
    if (ptMatch) return String(Math.round(Number(ptMatch[1]) * 2));
    const pxMatch = fontSize.match(/^([\d.]+)\s*px$/i);
    if (pxMatch) return String(Math.round(Number(pxMatch[1]) * 1.5));
    return DEFAULT_WORD_SZ;
}

function wordFontXml(fontFamily?: string): string {
    const font = (fontFamily?.split(",")[0]?.trim() || DEFAULT_WORD_FONT).replace(/"/g, "");
    return `<w:rFonts w:ascii="${escapeXmlText(font)}" w:hAnsi="${escapeXmlText(font)}" w:eastAsia="${escapeXmlText(font)}" w:cs="${escapeXmlText(font)}"/>`;
}

function runWordProperties(opts?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontFamily?: string;
    fontSize?: string;
}): string {
    const parts = [
        wordFontXml(opts?.fontFamily),
        `<w:sz w:val="${ptToWordHalfPoints(opts?.fontSize)}"/><w:szCs w:val="${ptToWordHalfPoints(opts?.fontSize)}"/>`,
    ];
    if (opts?.bold) parts.unshift("<w:b/>");
    if (opts?.italic) parts.unshift("<w:i/>");
    if (opts?.underline) parts.push('<w:u w:val="single"/>');
    return `<w:rPr>${parts.join("")}</w:rPr>`;
}

function textNodeRunXml(node: TipTapNode): string {
    const textStyle = node.marks?.find((m) => m.type === "textStyle")?.attrs ?? {};
    const rPr = runWordProperties({
        bold: Boolean(node.marks?.some((m) => m.type === "bold")),
        italic: Boolean(node.marks?.some((m) => m.type === "italic")),
        underline: Boolean(node.marks?.some((m) => m.type === "underline")),
        fontFamily: typeof textStyle.fontFamily === "string" ? textStyle.fontFamily : undefined,
        fontSize: typeof textStyle.fontSize === "string" ? textStyle.fontSize : undefined,
    });
    const lines = (node.text ?? "").split("\n");
    return lines.map((line, i) => {
        const br = i > 0 ? "<w:br/>" : "";
        return `<w:r>${rPr}${br}<w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r>`;
    }).join("");
}

function inlineNodesToRunXml(children: TipTapNode[]): string {
    return children.map((child) => {
        if (child.type === "hardBreak") {
            return `<w:r>${runWordProperties()}<w:br/></w:r>`;
        }
        if (child.type === "text") {
            return textNodeRunXml(child);
        }
        return inlineNodesToRunXml(child.content ?? []);
    }).join("");
}

function paragraphWordXml(node: TipTapNode): string {
    const align = typeof node.attrs?.textAlign === "string" ? node.attrs.textAlign : undefined;
    const wordAlign = mapTipTapAlign(align);
    const jc = wordAlign ? `<w:jc w:val="${wordAlign}"/>` : "";
    const pPr = `<w:pPr>${jc}${runWordProperties()}</w:pPr>`;
    const children = node.content ?? [];
    if (children.length === 0) return `<w:p>${pPr}</w:p>`;
    const runs = inlineNodesToRunXml(children);
    return `<w:p>${pPr}${runs}</w:p>`;
}

function pxToTwips(px: number): number {
    return Math.max(1, Math.round(px * 15));
}

function hexToWordColor(hex?: string): string {
    if (!hex) return "000000";
    const cleaned = hex.replace("#", "").toUpperCase();
    if (/^[0-9A-F]{6}$/.test(cleaned)) return cleaned;
    if (/^[0-9A-F]{3}$/.test(cleaned)) {
        return cleaned.split("").map((c) => `${c}${c}`).join("");
    }
    return "000000";
}

function tableColumnWidths(node: TipTapNode, colCount: number): number[] {
    const borderless = node.attrs?.borderless === true || node.attrs?.borderVisible === false;
    const contentWidth = 9288;
    const fallback = Math.floor(contentWidth / Math.max(1, colCount));
    const widths = Array.from({ length: colCount }, () => fallback);
    let hasExplicit = false;
    const firstRow = node.content?.[0];
    firstRow?.content?.forEach((cell, index) => {
        const colwidth = cell.attrs?.colwidth;
        const px = Array.isArray(colwidth) ? colwidth[0] : undefined;
        if (typeof px === "number" && px > 0 && index < widths.length) {
            widths[index] = pxToTwips(px);
            hasExplicit = true;
        }
    });
    if (!hasExplicit && borderless && colCount === 2) {
        return [3511, 5777];
    }
    return widths;
}

function tableWordXml(node: TipTapNode): string {
    const rows = node.content ?? [];
    const borderless = node.attrs?.borderless === true || node.attrs?.borderVisible === false;
    const borderColor = hexToWordColor(
        typeof node.attrs?.borderColor === "string" ? node.attrs.borderColor : undefined,
    );
    const colCount = Math.max(1, ...rows.map((row) => row.content?.length ?? 0));
    const widths = tableColumnWidths(node, colCount);
    const tableWidth = widths.reduce((sum, width) => sum + width, 0);
    const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
    const rowXml = rows.map((row) => {
        const cells = row.content ?? [];
        const rowHeight = typeof row.attrs?.height === "number" ? row.attrs.height : undefined;
        const trPr = rowHeight
            ? `<w:trPr><w:trHeight w:val="${pxToTwips(rowHeight)}" w:hRule="atLeast"/></w:trPr>`
            : "";
        const cellXml = Array.from({ length: colCount }, (_, i) => {
            const cell = cells[i];
            const paras = (cell?.content ?? []).filter((c) =>
                c.type === "paragraph" || c.type === "heading"
            );
            const body = paras.length > 0
                ? paras.map(paragraphWordXml).join("")
                : paragraphWordXml({ type: "paragraph" });
            const cellW = widths[i]!;
            return `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${body}</w:tc>`;
        }).join("");
        return `<w:tr>${trPr}${cellXml}</w:tr>`;
    }).join("");
    const borders = borderless
        ? `<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>
      <w:insideH w:val="nil"/><w:insideV w:val="nil"/>`
        : `<w:top w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${borderColor}"/>`;
    const indent = borderless ? `<w:tblInd w:w="-108" w:type="dxa"/>` : "";
    return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${tableWidth}" w:type="dxa"/>
    <w:jc w:val="left"/>
    ${indent}
    <w:tblBorders>
      ${borders}
    </w:tblBorders>
    <w:tblLayout w:type="fixed"/>
    <w:tblCellMar>
      <w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>
      <w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tblGrid>${grid}</w:tblGrid>
  ${rowXml}
</w:tbl>`;
}

function listWordXml(node: TipTapNode): string {
    const items = node.content ?? [];
    return items.map((item, i) => {
        const prefix = node.type === "orderedList" ? `${i + 1}. ` : "• ";
        const text = collectInline(item).text;
        return paragraphWordXml({
            type: "paragraph",
            content: [{ type: "text", text: `${prefix}${text}` }],
        });
    }).join("");
}

export function tipTapToWordBodyXml(doc: TipTapDocument): string {
    return doc.content.map((node) => {
        if (node.type === "table") return tableWordXml(node);
        if (node.type === "bulletList" || node.type === "orderedList") return listWordXml(node);
        if (node.type === "paragraph" || node.type === "heading") return paragraphWordXml(node);
        return (node.content ?? []).map((child) =>
            child.type === "table"
                ? tableWordXml(child)
                : paragraphWordXml(child)
        ).join("");
    }).join("");
}

const DEFAULT_SECT_PR =
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="720" w:footer="720"/></w:sectPr>`;

const DEFAULT_DOCUMENT_OPEN =
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`;

/** Clone the asset DOCX zip and replace document.xml body with TipTap content, keeping styles/sectPr. */
export async function renderTipTapIntoAssetDocx(
    key: AssetDocxTemplateKey,
    doc: TipTapDocument,
): Promise<Uint8Array> {
    const bytes = await loadAssetDocxTemplate(key);
    const zip = new PizZip(bytes);
    const original = zip.file("word/document.xml")?.asText() ?? "";
    const sectPr = original.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? DEFAULT_SECT_PR;
    const docOpen = original.match(/<w:document\b[^>]*>/)?.[0] ?? DEFAULT_DOCUMENT_OPEN;
    const bodyXml = tipTapToWordBodyXml(doc);
    const documentXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${docOpen}<w:body>${bodyXml}${sectPr}</w:body></w:document>`;
    zip.file("word/document.xml", documentXml);
    return zip.generate({ type: "uint8array" }) as Uint8Array;
}

export { fillDocxBlankRuns };
