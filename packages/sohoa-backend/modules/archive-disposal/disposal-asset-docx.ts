import PizZip from "pizzip";

import { renderDocxTemplate } from "./disposal-appendix-docx.ts";
import {
    ASSET_DOCX_TEMPLATES,
    type TipTapDocument,
    type TipTapNode,
} from "./disposal-document-tiptap.ts";

const ASSETS_DIR = new URL("../../assets/", import.meta.url);

export type AssetDocxTemplateKey = keyof typeof ASSET_DOCX_TEMPLATES;

export type DocxParagraph = {
    text: string;
    align?: string;
    bold: boolean;
};

export async function loadAssetDocxTemplate(key: AssetDocxTemplateKey): Promise<Uint8Array> {
    const filename = ASSET_DOCX_TEMPLATES[key];
    const url = new URL(filename, ASSETS_DIR);
    try {
        return await Deno.readFile(url);
    } catch {
        throw new Error(`Không tìm thấy mẫu DOCX trong assets: ${filename}`);
    }
}

/** Extract visible paragraphs from a DOCX (official form layout). */
export function extractDocxParagraphs(docxBytes: Uint8Array): DocxParagraph[] {
    const zip = new PizZip(docxBytes);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const paragraphs: DocxParagraph[] = [];
    for (const match of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
        const block = match[0]!;
        const text = [...block.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
            .map((m) => m[1]!)
            .join("")
            .trim();
        if (!text) continue;
        const jc = block.match(/<w:jc\s+w:val="([^"]+)"/);
        const bold = /<w:b[\s/>]/.test(block);
        paragraphs.push({
            text,
            align: jc?.[1],
            bold,
        });
    }
    return paragraphs;
}

export async function loadAssetDocxParagraphs(
    key: AssetDocxTemplateKey,
): Promise<DocxParagraph[]> {
    const bytes = await loadAssetDocxTemplate(key);
    return extractDocxParagraphs(bytes);
}

/** Replace blank runs (…… / ....) left-to-right with queued values. */
export function fillDocxBlankRuns(text: string, queue: string[]): string {
    return text.replace(/[.….]{2,}|_{2,}/g, () => {
        if (queue.length === 0) return "……";
        return queue.shift()!;
    });
}

export function paragraphsToTipTap(
    paragraphs: DocxParagraph[],
    transformText?: (text: string, index: number) => string,
): TipTapDocument {
    const content: TipTapNode[] = paragraphs.map((p, index) => {
        const text = transformText ? transformText(p.text, index) : p.text;
        const marks = p.bold ? [{ type: "bold" }] : undefined;
        const isTitle = p.bold && (p.align === "center" || text === text.toUpperCase());
        if (isTitle && text.length < 80 && !text.includes("……") && !/[.….]{3,}/.test(text)) {
            return {
                type: "heading",
                attrs: { level: 2, textAlign: p.align ?? "center" },
                content: text ? [{ type: "text", text, marks: [{ type: "bold" }] }] : undefined,
            };
        }
        return {
            type: "paragraph",
            attrs: p.align ? { textAlign: p.align } : undefined,
            content: text
                ? [{ type: "text", text, ...(marks ? { marks } : {}) }]
                : undefined,
        };
    });
    return { type: "doc", content };
}

export async function tryLoadAssetDocxTemplate(key: AssetDocxTemplateKey): Promise<Uint8Array | null> {
    try {
        return await loadAssetDocxTemplate(key);
    } catch {
        return null;
    }
}

function escapeXmlText(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const PLAIN_DOCX_RUN_PROPS =
    `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/>{{bold}}</w:rPr>`;

function paragraphXml(text: string, opts?: { bold?: boolean; align?: string }): string {
    const align = opts?.align
        ? `<w:jc w:val="${opts.align}"/>`
        : "";
    const pPr = align ? `<w:pPr>${align}</w:pPr>` : "";
    const rPr = PLAIN_DOCX_RUN_PROPS.replace("{{bold}}", opts?.bold ? "<w:b/>" : "");
    const lines = text.split("\n");
    const runs = lines.map((line, i) => {
        const br = i > 0 ? "<w:br/>" : "";
        return `<w:r>${rPr}${br}<w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r>`;
    }).join("");
    return `<w:p>${pPr}${runs}</w:p>`;
}

/** Minimal DOCX from plain text — fallback when asset template unavailable. */
export function buildPlainTextDocx(body: string, title?: string): Uint8Array {
    const paragraphs = title
        ? [paragraphXml(title, { bold: true, align: "center" }), paragraphXml("")]
        : [];
    for (const block of body.split(/\n\n+/)) {
        paragraphs.push(paragraphXml(block.trim()));
    }
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

    const zip = new PizZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    zip.file("word/document.xml", documentXml);
    return zip.generate({ type: "uint8array" }) as Uint8Array;
}

export async function fillAssetDocxBody(
    key: AssetDocxTemplateKey,
    data: Record<string, string>,
): Promise<Uint8Array> {
    const template = await loadAssetDocxTemplate(key);
    return renderDocxTemplate(template, data);
}

export async function fillAssetDocxBodyOrPlain(
    key: AssetDocxTemplateKey,
    data: Record<string, string>,
    plainFallback: string,
    title?: string,
): Promise<Uint8Array> {
    try {
        return await fillAssetDocxBody(key, data);
    } catch {
        return buildPlainTextDocx(plainFallback, title);
    }
}
