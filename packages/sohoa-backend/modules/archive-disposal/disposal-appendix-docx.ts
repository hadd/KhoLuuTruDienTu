import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

export type AppendixCatalogRow = {
    boxNumber: string;
    volumeNumber: string;
    title: string;
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
        const t = blockText(rows[i]!).replace(/\s+/g, "");
        if (t === "" || /^\.+$/.test(t)) return i;
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

    const headerRows = rowMatches.slice(0, templateIdx);
    const templateRow = rowMatches[templateIdx]!;
    const dataRows = rows.length > 0
        ? rows.map((row) =>
            setRowCellTexts(templateRow, [
                row.boxNumber,
                row.volumeNumber,
                row.title,
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
    options?: { tableRows?: AppendixCatalogRow[] },
): Uint8Array {
    const zip = new PizZip(templateBytes);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
    });
    doc.render(data);
    let out = doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
    if (options?.tableRows) {
        const outZip = new PizZip(out);
        let xml = outZip.file("word/document.xml")!.asText();
        xml = fillCatalogTableInDocumentXml(xml, options.tableRows);
        outZip.file("word/document.xml", xml);
        out = outZip.generate({ type: "uint8array" }) as Uint8Array;
    }
    return out;
}

export async function loadAppendixTemplate(name: "phu-luc-ii-danh-muc.docx" | "phu-luc-iii-thuyet-minh.docx") {
    const url = new URL(`./templates/${name}`, import.meta.url);
    return await Deno.readFile(url);
}
