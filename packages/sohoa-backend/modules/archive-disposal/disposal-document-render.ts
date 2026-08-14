import type { TipTapDocument, TipTapNode } from "./disposal-document-tiptap.ts";
import { tipTapDocumentToPlainText } from "./disposal-document-tiptap.ts";
import { buildPlainTextDocx } from "./disposal-asset-docx.ts";

function nodeAlign(node: TipTapNode): string | undefined {
    const align = node.attrs?.textAlign;
    return typeof align === "string" ? align : undefined;
}

function collectInlineText(node: TipTapNode): string {
    if (node.type === "text" && node.text) return node.text;
    return (node.content ?? []).map(collectInlineText).join("");
}

function isBoldNode(node: TipTapNode): boolean {
    return Boolean(node.marks?.some((m) => m.type === "bold"));
}

function renderBlock(node: TipTapNode): string {
    if (node.type === "heading") {
        const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
        const text = (node.content ?? []).map(collectInlineText).join("");
        const prefix = "#".repeat(Math.min(level, 6));
        return `${prefix} ${text}`;
    }
    if (node.type === "paragraph") {
        return (node.content ?? []).map(collectInlineText).join("");
    }
    if (node.type === "bulletList") {
        return (node.content ?? [])
            .map((item) => {
                const text = (item.content ?? []).map(renderBlock).join("\n").trim();
                return `• ${text}`;
            })
            .join("\n");
    }
    if (node.type === "orderedList") {
        return (node.content ?? [])
            .map((item, i) => {
                const text = (item.content ?? []).map(renderBlock).join("\n").trim();
                return `${i + 1}. ${text}`;
            })
            .join("\n");
    }
    return (node.content ?? []).map(renderBlock).join("\n");
}

export function tipTapDocumentToPlainBody(doc: TipTapDocument): string {
    return tipTapDocumentToPlainText(doc);
}

export function renderTipTapDocumentToDocx(doc: TipTapDocument, title?: string): Uint8Array {
    const blocks: string[] = [];
    for (const node of doc.content) {
        if (node.type === "heading") {
            blocks.push(renderBlock(node));
            continue;
        }
        if (node.type === "paragraph") {
            const text = renderBlock(node);
            blocks.push(text);
            continue;
        }
        if (node.type === "bulletList" || node.type === "orderedList") {
            blocks.push(renderBlock(node));
        }
    }
    const body = blocks.join("\n\n");
    const firstHeading = doc.content.find((n) => n.type === "heading");
    const docTitle = title ?? (firstHeading ? collectInlineText(firstHeading) : undefined);
    return buildPlainTextDocx(body, docTitle);
}

/** Map textAlign values to Word jc values for future rich render. */
export function mapTextAlign(align?: string): string | undefined {
    if (align === "left" || !align) return "left";
    if (align === "center") return "center";
    if (align === "right") return "right";
    if (align === "justify") return "both";
    return undefined;
}

export function paragraphIsBold(node: TipTapNode): boolean {
    if (node.type !== "paragraph") return false;
    return (node.content ?? []).some(isBoldNode);
}
