import { httpError } from "@shared/common-lib";
import { getWatermarkImageMaxBytes } from "./watermark-storage-keys.ts";

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type WatermarkImageKind = "png" | "svg";

export type ValidatedWatermarkImage = {
    kind: WatermarkImageKind;
    mimeType: "image/png" | "image/svg+xml";
    extension: "png" | "svg";
    bytes: Uint8Array;
    /** Sanitized SVG text when kind === "svg" */
    sanitizedSvg?: string;
};

function startsWithBytes(data: Uint8Array, magic: Uint8Array): boolean {
    if (data.length < magic.length) return false;
    for (let i = 0; i < magic.length; i++) {
        if (data[i] !== magic[i]) return false;
    }
    return true;
}

function resolveExtension(filename: string): string {
    const idx = filename.lastIndexOf(".");
    if (idx < 0) return "";
    return filename.slice(idx + 1).toLowerCase();
}

function looksLikeSvg(bytes: Uint8Array): boolean {
    const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.byteLength, 4096)));
    const trimmed = text.trimStart();
    return trimmed.startsWith("<") || trimmed.startsWith("<?xml");
}

/** Resolve kind from lowercase extension, then magic/content fallback. */
function resolveKind(
    bytes: Uint8Array,
    originalFilename: string,
): WatermarkImageKind {
    const ext = resolveExtension(originalFilename);
    if (ext === "png" || ext === "svg") return ext;
    if (startsWithBytes(bytes, PNG_MAGIC)) return "png";
    if (looksLikeSvg(bytes)) return "svg";
    throw httpError.badRequest(
        "Chỉ chấp nhận ảnh watermark định dạng png hoặc svg (không phân biệt hoa/thường)",
    );
}

/** Strip dangerous SVG constructs (scripts, event handlers, external refs). */
export function sanitizeSvgMarkup(raw: string): string {
    let svg = raw;

    // Remove script / foreignObject / iframe / object / embed blocks
    svg = svg.replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
    svg = svg.replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*\/\s*>/gi, "");

    // Remove event-handler attributes
    svg = svg.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

    // Neutralize javascript: / data:text/html URLs
    svg = svg.replace(
        /(href|xlink:href|src)\s*=\s*(["'])\s*(javascript:|data:\s*text\/html)[\s\S]*?\2/gi,
        '$1=$2#$2',
    );

    // Block external http(s) use/href references
    svg = svg.replace(
        /(href|xlink:href)\s*=\s*(["'])\s*https?:\/\/[\s\S]*?\2/gi,
        '$1=$2#$2',
    );

    if (!/<\s*svg\b/i.test(svg)) {
        throw httpError.badRequest("SVG không hợp lệ: thiếu thẻ <svg>");
    }

    return svg;
}

export function validateWatermarkImageBytes(
    bytes: Uint8Array,
    originalFilename: string,
): ValidatedWatermarkImage {
    const maxBytes = getWatermarkImageMaxBytes();
    if (bytes.byteLength <= 0) {
        throw httpError.badRequest("File ảnh watermark trống");
    }
    if (bytes.byteLength > maxBytes) {
        throw httpError.badRequest(
            `Ảnh watermark vượt quá ${Math.floor(maxBytes / (1024 * 1024))}MB`,
        );
    }

    const kind = resolveKind(bytes, originalFilename);

    if (kind === "png") {
        if (!startsWithBytes(bytes, PNG_MAGIC)) {
            throw httpError.badRequest("File không phải png hợp lệ (sai magic bytes)");
        }
        return {
            kind: "png",
            mimeType: "image/png",
            extension: "png",
            bytes,
        };
    }

    const text = new TextDecoder().decode(bytes);
    const trimmed = text.trimStart();
    if (!trimmed.startsWith("<") && !trimmed.startsWith("<?xml")) {
        throw httpError.badRequest("File không phải svg hợp lệ");
    }
    if (text.length > 512_000) {
        throw httpError.badRequest("SVG watermark quá lớn (tối đa 500KB text)");
    }

    const sanitizedSvg = sanitizeSvgMarkup(text);
    return {
        kind: "svg",
        mimeType: "image/svg+xml",
        extension: "svg",
        bytes: new TextEncoder().encode(sanitizedSvg),
        sanitizedSvg,
    };
}
