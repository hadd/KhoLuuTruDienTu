import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "npm:@pdf-lib/fontkit";
import forge from "npm:node-forge";

export type PdfByteRange = [number, number, number, number];

export interface VisualSignatureConfig {
    pageNumber?: number;
    xRatio?: number;
    yRatio?: number;
    /** Legacy fixed-size box in PDF points — kept for backward compatibility. */
    widthPx?: number;
    heightPx?: number;
    /** Preferred: box size as a percent of the page's width/height (0-100),
     * matching the resizable placement box the user draws in the PDF
     * preview. Using a ratio (rather than fixed points) keeps the drawn
     * box the exact same relative size regardless of page dimensions. */
    widthRatio?: number;
    heightRatio?: number;
    reason?: string;
    location?: string;
    appearanceType?: string;
    stampImageBase64?: string;
}

export interface PreparedPdfResult {
    preparedPdf: Uint8Array;
    hashBase64: string;
    byteRange: PdfByteRange;
    /** Base64 DER of authenticatedAttributes — must be reused at embed time */
    authAttrsDerBase64: string;
    contentsOffset: number;
    contentsLength: number;
}

export interface PdfSignatureVerification {
    valid: boolean;
    reason?: string;
    certificateSubject?: string;
    certificateIssuer?: string;
    signedAt?: string;
}

/** Hex chars reserved for CMS in /Contents <...> (must be even). */
const SIGNATURE_CONTENTS_HEX_LENGTH = 16384;

function base64FromBytes(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
}

function bytesFromBase64(base64: string): Uint8Array {
    const clean = base64.replace(/^data:[^;]+;base64,/, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
    const copy = new Uint8Array(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return new Uint8Array(digest);
}

function concatUint8(a: Uint8Array, b: Uint8Array): Uint8Array {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}

function findSubarray(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
    outer: for (let i = from; i <= haystack.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) continue outer;
        }
        return i;
    }
    return -1;
}

function encoder(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

/**
 * Byte-for-byte decode of a PDF buffer into a JS "binary string" where each
 * char code 0-255 exactly matches the source byte.
 *
 * DO NOT use `new TextDecoder("latin1")` for this: per the WHATWG Encoding
 * Standard, the "latin1"/"iso-8859-1" labels are aliases for windows-1252,
 * which remaps bytes 0x80-0x9F to various Unicode codepoints (smart quotes,
 * œ, etc.) instead of preserving them as U+0080-U+009F. Round-tripping such
 * a string back to bytes via `charCodeAt(i) & 0xff` then silently corrupts
 * any binary content (compressed streams, embedded fonts/images) that
 * contains bytes in that range — this previously caused signed PDFs to
 * render as blank pages because Flate-compressed content streams were
 * mangled.
 */
function binaryStringFromBytes(bytes: Uint8Array): string {
    // Avoid String.fromCharCode.apply/spread stack limits on large PDFs by
    // chunking.
    const CHUNK = 0x8000;
    let result = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
        result += String.fromCharCode.apply(
            null,
            // deno-lint-ignore no-explicit-any
            bytes.subarray(i, i + CHUNK) as any,
        );
    }
    return result;
}

function bytesFromBinaryString(str: string): Uint8Array {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        out[i] = str.charCodeAt(i) & 0xff;
    }
    return out;
}

function pdfEscape(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function parseCnFromSubject(subject: string): string {
    if (!subject) return "Người ký";
    const cnMatch = subject.match(/CN=([^,]+)/i);
    if (cnMatch?.[1]) return cnMatch[1].trim();
    return subject.trim();
}

/** Map of RDN OIDs -> short attribute names, matching how Foxit/Adobe render DN. */
const RDN_OID_SHORT_NAMES: Record<string, string> = {
    "2.5.4.6": "C",
    "2.5.4.8": "ST",
    "2.5.4.7": "L",
    "2.5.4.10": "O",
    "2.5.4.11": "OU",
    "2.5.4.3": "CN",
    "2.5.4.5": "SERIALNUMBER",
    "2.5.4.4": "SN",
    "2.5.4.42": "GN",
    "2.5.4.12": "T",
    "2.5.4.9": "STREET",
    "1.2.840.113549.1.9.1": "E",
    "0.9.2342.19200300.100.1.1": "UID",
};

/**
 * Build the full DN string ("C=VN, O=..., CN=..., L=..., UID=..., E=...")
 * directly from the certificate's DER bytes, preserving the RDN order as
 * actually encoded in the certificate. This matches what Foxit/Adobe show
 * and is far more complete than whatever partial string a signing agent
 * happens to expose via `X509Certificate2.Subject` (which only recognizes
 * a subset of RDN types and may reorder/drop fields like L= or UID=).
 */
/**
 * Some VN CAs encode DirectoryString RDN values (CN, O, L, ...) using an
 * ASN.1 string type other than UTF8String (e.g. PrintableString/
 * TeletexString/IA5String) while actually stuffing raw UTF-8 bytes inside.
 * `node-forge` decodes those types byte-for-byte as Latin-1 (each byte ->
 * one char code 0-255), which turns valid UTF-8 (e.g. Vietnamese
 * diacritics) into mojibake like "CÃ´NG" instead of "CÔNG".
 *
 * Detect this by checking whether every char code fits in a byte (only
 * possible if forge's decoder treated it as raw Latin-1) and whether
 * reinterpreting those bytes as UTF-8 round-trips into valid, sensible
 * text. A correctly decoded Vietnamese string will contain codepoints
 * outside the 0x00-0xFF range (Vietnamese combining-diacritic letters
 * like "ệ", "ố", "ữ" live at U+1EA0-U+1EF9), so this never fires for
 * already-correct strings.
 */
function fixMojibakeUtf8(input: string): string {
    if (!input) return input;
    let allByteSized = true;
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code > 0xff) {
            allByteSized = false;
            break;
        }
        bytes[i] = code;
    }
    if (!allByteSized) return input;
    // Only worth attempting if there's actually a non-ASCII byte present.
    if (!bytes.some((b) => b >= 0x80)) return input;
    try {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return decoded;
    } catch {
        return input;
    }
}

/**
 * Canonical DN field order as shown by Foxit/Adobe (NOT the raw RDN
 * encoding order in the certificate, which varies by CA and can list
 * C, L, UID, O, E, CN in whatever order the issuer's software wrote them).
 * Any short name not listed here is appended at the end, in the order
 * it was encountered.
 */
const DN_DISPLAY_ORDER = ["C", "CN", "L", "ST", "O", "OU", "UID", "SERIALNUMBER", "E", "T", "GN", "SN"];

function buildDnFromCertificateBase64(certificateBase64?: string): string | undefined {
    if (!certificateBase64) return undefined;
    try {
        const certDerBytes = bytesFromBase64(certificateBase64);
        const certDerStr = Array.from(certDerBytes)
            .map((b) => String.fromCharCode(b))
            .join("");
        const asn1 = forge.asn1.fromDer(certDerStr);
        const cert = forge.pki.certificateFromAsn1(asn1);
        const entries = (cert.subject.attributes as Array<Record<string, unknown>>)
            .map((attr) => {
                const type = typeof attr.type === "string" ? attr.type : undefined;
                const shortName = (typeof attr.shortName === "string" ? attr.shortName : undefined) ||
                    (type ? RDN_OID_SHORT_NAMES[type] : undefined) ||
                    (typeof attr.name === "string" ? attr.name : undefined) ||
                    type;
                const rawValue = typeof attr.value === "string" ? attr.value : String(attr.value ?? "");
                const value = fixMojibakeUtf8(rawValue);
                if (!shortName || !value) return null;
                return { shortName, value };
            })
            .filter((v): v is { shortName: string; value: string } => Boolean(v));

        const sorted = entries
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => {
                const orderA = DN_DISPLAY_ORDER.indexOf(a.entry.shortName);
                const orderB = DN_DISPLAY_ORDER.indexOf(b.entry.shortName);
                const rankA = orderA === -1 ? DN_DISPLAY_ORDER.length + a.index : orderA;
                const rankB = orderB === -1 ? DN_DISPLAY_ORDER.length + b.index : orderB;
                return rankA - rankB;
            })
            .map(({ entry }) => `${entry.shortName}=${entry.value}`);

        return sorted.length > 0 ? sorted.join(", ") : undefined;
    } catch (err) {
        console.warn("buildDnFromCertificateBase64 failed:", err);
        return undefined;
    }
}

function getFoxitDateFormat(d: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+07'00'`;
}

function wrapText(text: string, maxLineWidth: number, font: any, fontSize: number): string[] {
    if (!text) return [];
    const safeWidth = Math.max(1, maxLineWidth);

    const splitOversizedWord = (word: string): string[] => {
        if (!font || typeof font.widthOfTextAtSize !== "function") {
            const charWidth = Math.max(0.1, fontSize * 0.55);
            const maxChars = Math.max(1, Math.floor(safeWidth / charWidth));
            const parts: string[] = [];
            for (let i = 0; i < word.length; i += maxChars) {
                parts.push(word.slice(i, i + maxChars));
            }
            return parts.length ? parts : [word];
        }
        if (font.widthOfTextAtSize(word, fontSize) <= safeWidth) return [word];
        const parts: string[] = [];
        let chunk = "";
        for (const ch of word) {
            const test = chunk + ch;
            if (font.widthOfTextAtSize(test, fontSize) <= safeWidth) {
                chunk = test;
            } else {
                if (chunk) parts.push(chunk);
                chunk = ch;
            }
        }
        if (chunk) parts.push(chunk);
        return parts.length ? parts : [word];
    };

    if (!font || typeof font.widthOfTextAtSize !== "function") {
        const charWidth = Math.max(0.1, fontSize * 0.55);
        const maxChars = Math.max(1, Math.floor(safeWidth / charWidth));
        const words = text.split(" ");
        const lines: string[] = [];
        let curr = "";
        for (const w of words) {
            for (const part of splitOversizedWord(w)) {
                if ((curr + " " + part).trim().length <= maxChars) {
                    curr = curr ? `${curr} ${part}` : part;
                } else {
                    if (curr) lines.push(curr);
                    curr = part;
                }
            }
        }
        if (curr) lines.push(curr);
        return lines;
    }

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
        for (const part of splitOversizedWord(word)) {
            const testLine = currentLine ? `${currentLine} ${part}` : part;
            const width = font.widthOfTextAtSize(testLine, fontSize);
            if (width <= safeWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = part;
            }
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

const BUNDLED_SIGNATURE_FONT = new URL(
    "../../libs/watermark/fonts/NotoSans-Regular.ttf",
    import.meta.url,
);

const SYSTEM_FONT_CANDIDATES = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/arialuni.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];

const SYSTEM_BOLD_FONT_CANDIDATES = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];

async function readSignatureFontBytes(): Promise<Uint8Array> {
    try {
        return await Deno.readFile(BUNDLED_SIGNATURE_FONT);
    } catch (bundledErr) {
        for (const path of SYSTEM_FONT_CANDIDATES) {
            try {
                return await Deno.readFile(path);
            } catch {
                // try next
            }
        }
        throw new Error(
            `Không tìm thấy font để vẽ chữ ký số (NotoSans bundled + system fonts). ${
                bundledErr instanceof Error ? bundledErr.message : String(bundledErr)
            }`,
        );
    }
}

async function readSignatureBoldFontBytes(): Promise<Uint8Array> {
    for (const path of SYSTEM_BOLD_FONT_CANDIDATES) {
        try {
            return await Deno.readFile(path);
        } catch {
            // try next
        }
    }
    // Fall back to regular (NotoSans has no separate bold file in repo)
    return await readSignatureFontBytes();
}

/**
 * Draw Foxit-like visual signature appearance onto the PDF (before cryptographic placeholder).
 */
export async function applyVisualAppearance(
    originalPdfBytes: Uint8Array,
    signerInfo?: {
        subject?: string;
        issuer?: string;
        certificateBase64?: string;
        visualSignature?: VisualSignatureConfig;
    },
): Promise<Uint8Array> {
    try {
        const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        if (pages.length === 0) return originalPdfBytes;

        pdfDoc.registerFontkit(fontkit);
        const appearanceTypeEarly = signerInfo?.visualSignature?.appearanceType ?? "standard";
        const needsTextFont = appearanceTypeEarly !== "image_only";

        let fontRegular: any;
        let fontBold: any;
        if (needsTextFont) {
            // Fail prepare loudly if font missing — otherwise crypto signing
            // succeeds with an invisible stamp (common on Linux/Docker).
            fontRegular = await pdfDoc.embedFont(await readSignatureFontBytes());
            fontBold = await pdfDoc.embedFont(await readSignatureBoldFontBytes());
        }

        const visual = signerInfo?.visualSignature;
        const requestedPage = visual?.pageNumber ? visual.pageNumber - 1 : 0;
        const targetPageIndex = Math.max(0, Math.min(requestedPage, pages.length - 1));
        const targetPage = pages[targetPageIndex]!;
        const { width: pageW, height: pageH } = targetPage.getSize();

        const boxWidth = visual?.widthRatio !== undefined
            ? (visual.widthRatio / 100) * pageW
            : visual?.widthPx ?? 380;
        const boxHeight = visual?.heightRatio !== undefined
            ? (visual.heightRatio / 100) * pageH
            : visual?.heightPx ?? 130;

        let x: number;
        let pdfY: number;
        if (visual?.xRatio !== undefined && visual?.yRatio !== undefined) {
            x = (visual.xRatio / 100) * pageW;
            const webY = (visual.yRatio / 100) * pageH;
            pdfY = pageH - webY - boxHeight;
        } else {
            x = Math.max(10, pageW - boxWidth - 20);
            pdfY = 20;
        }
        x = Math.max(5, Math.min(x, pageW - boxWidth - 5));
        pdfY = Math.max(5, Math.min(pdfY, pageH - boxHeight - 5));

        const appearanceType = visual?.appearanceType ?? "standard";

        // No fill/border: only signature text (or stamp image) is drawn on top
        // of the page content, matching Foxit's transparent appearance style.

        if (appearanceType === "image_only" && visual?.stampImageBase64) {
            try {
                const imgBytes = bytesFromBase64(visual.stampImageBase64);
                const embeddedImg = visual.stampImageBase64.includes("image/png")
                    ? await pdfDoc.embedPng(imgBytes)
                    : await pdfDoc.embedJpg(imgBytes);
                targetPage.drawImage(embeddedImg, {
                    x: x + 2,
                    y: pdfY + 2,
                    width: boxWidth - 4,
                    height: boxHeight - 4,
                });
            } catch (imgErr) {
                console.warn("Failed to embed stamp image:", imgErr);
            }
        } else {
            const subjectInput = signerInfo?.subject || "Người ký";
            // Prefer the full DN parsed directly from the certificate DER (all
            // RDN fields — C, O, L, CN, UID/MST, E — in the order actually
            // encoded), since the subject string reported by signing agents
            // (e.g. .NET's X509Certificate2.Subject) only recognizes a subset
            // of RDN types and drops/reorders fields like L= or UID=.
            const certDn = buildDnFromCertificateBase64(signerInfo?.certificateBase64);
            const fullDn = certDn ??
                (subjectInput.includes("CN=") || subjectInput.includes("C=")
                    ? subjectInput
                    : `C=VN, CN=${parseCnFromSubject(subjectInput)}, O=${parseCnFromSubject(subjectInput)}`);
            const cnName = parseCnFromSubject(fullDn) || parseCnFromSubject(subjectInput);
            const reason = visual?.reason || "I am the author of this document";
            const location = visual?.location || "";
            const dateStr = getFoxitDateFormat();

            // Foxit-like two-column layout, always:
            //   LEFT  = bold signer name (CN)
            //   RIGHT = technical details (Digitally signed by / DN / Reason / ...)
            // A single scale factor shrinks BOTH columns together so text never
            // overflows the dashed frame and never drops any field.
            const detailLines = [
                `Digitally signed by ${cnName}`,
                `DN: ${fullDn}`,
                `Reason: ${reason}`,
                `Location: ${location}`,
                `Date: ${dateStr}`,
            ];

            const padX = 4;
            const padY = 3;
            const gap = 4;
            const availableHeight = Math.max(1, boxHeight - padY * 2);
            // Bold name on the left; details take more width for the long DN.
            const titleWidth = Math.max(8, boxWidth * 0.42 - padX - gap / 2);
            const detailsWidth = Math.max(8, boxWidth * 0.58 - padX - gap / 2);
            const titleStartX = x + padX;
            const detailsStartX = x + padX + titleWidth + gap;

            const TITLE_MAX = 10.5;
            const DETAIL_MAX = 7;
            // Line spacing scales with font size (Foxit-like proportional shrink).
            const titleLineFactor = 1.18;
            const detailLineFactor = 1.22;

            const layoutAt = (scale: number) => {
                const titleSize = Math.max(0.4, TITLE_MAX * scale);
                const detailSize = Math.max(0.35, DETAIL_MAX * scale);
                const titleSpacing = titleSize * titleLineFactor;
                const detailSpacing = detailSize * detailLineFactor;
                const titleLines = wrapText(cnName, titleWidth, fontBold, titleSize);
                const detailWrapped = detailLines.flatMap((raw) =>
                    wrapText(raw, detailsWidth, fontRegular, detailSize)
                );
                const titleHeight = titleLines.length * titleSpacing;
                const detailHeight = detailWrapped.length * detailSpacing;
                return {
                    titleSize,
                    detailSize,
                    titleSpacing,
                    detailSpacing,
                    titleLines,
                    detailWrapped,
                    fits: titleHeight <= availableHeight && detailHeight <= availableHeight,
                };
            };

            let best = layoutAt(1);
            if (!best.fits) {
                let lo = 0.02;
                let hi = 1;
                // Seed with the absolute floor so we never keep the oversized
                // layoutAt(1) result when nothing larger fits.
                best = layoutAt(lo);
                for (let i = 0; i < 24; i++) {
                    const mid = (lo + hi) / 2;
                    const candidate = layoutAt(mid);
                    if (candidate.fits) {
                        best = candidate;
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }
            }

            const bottomY = pdfY + padY;
            const topY = pdfY + boxHeight - padY;

            let titleY = topY - best.titleSize;
            for (const line of best.titleLines) {
                if (titleY < bottomY - 0.01) break;
                targetPage.drawText(line, {
                    x: titleStartX,
                    y: titleY,
                    size: best.titleSize,
                    font: fontBold,
                    color: rgb(0.05, 0.05, 0.05),
                });
                titleY -= best.titleSpacing;
            }

            let detailY = topY - best.detailSize;
            for (const line of best.detailWrapped) {
                if (detailY < bottomY - 0.01) break;
                targetPage.drawText(line, {
                    x: detailsStartX,
                    y: detailY,
                    size: best.detailSize,
                    font: fontRegular,
                    color: rgb(0.1, 0.1, 0.1),
                });
                detailY -= best.detailSpacing;
            }
        }

        return await pdfDoc.save({ useObjectStreams: false });
    } catch (err) {
        // Do NOT silently return the original PDF — that produces "ký thành công"
        // with only an invisible cryptographic signature and no visible stamp.
        console.error("applyVisualAppearance failed:", err);
        throw err instanceof Error
            ? err
            : new Error(`Không vẽ được hình chữ ký số lên PDF: ${String(err)}`);
    }
}

/**
 * Append an incremental-update signature placeholder WITHOUT modifying existing PDF bytes.
 * In-place Catalog/Page patches shift offsets and blank the document in viewers.
 */
export function addSignaturePlaceholder(pdfBytes: Uint8Array, reason = "Digital Signature"): Uint8Array {
    const pdf = binaryStringFromBytes(pdfBytes);

    const eofIndex = pdf.lastIndexOf("%%EOF");
    if (eofIndex === -1) {
        throw new Error("Invalid PDF: missing %%EOF");
    }
    // Keep original body intact (including final %%EOF); append after it.
    const originalPdf = pdf.slice(0, eofIndex + "%%EOF".length);

    const signature = "0".repeat(SIGNATURE_CONTENTS_HEX_LENGTH);
    // Fixed-width ByteRange placeholder so we can resolve without shifting length.
    const byteRangePlaceholder = "/ByteRange [0 /********** /********** /**********]";

    const objMatches = [...originalPdf.matchAll(/(\d+)\s+0\s+obj/g)];
    let maxObj = 1;
    for (const m of objMatches) {
        const n = Number(m[1]);
        if (n > maxObj) maxObj = n;
    }
    const signatureObj = maxObj + 1;
    const widgetObj = maxObj + 2;
    const formObj = maxObj + 3;
    const catalogObj = maxObj + 4;

    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const pdfDate =
        `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}+07'00'`;

    // Discover existing /Root and its /Pages ref from last trailer + catalog object
    let rootRef = "1 0 R";
    const rootMatch = originalPdf.match(/\/Root\s+(\d+\s+0\s+R)/g);
    if (rootMatch && rootMatch.length > 0) {
        const last = rootMatch[rootMatch.length - 1]!;
        const m = last.match(/\/Root\s+(\d+\s+0\s+R)/);
        if (m?.[1]) rootRef = m[1];
    }
    const rootObjNum = Number(rootRef.split(/\s+/)[0] ?? "1");

    let pagesRef = "2 0 R";
    const catalogObjRe = new RegExp(
        `${rootObjNum}\\s+0\\s+obj([\\s\\S]*?)endobj`,
    );
    const catalogMatch = originalPdf.match(catalogObjRe);
    if (catalogMatch?.[1]) {
        const pages = catalogMatch[1].match(/\/Pages\s+(\d+\s+0\s+R)/);
        if (pages?.[1]) pagesRef = pages[1];
    }

    // First page ref for widget /P (optional)
    let pageRef = pagesRef;
    const pageMatch = originalPdf.match(/(\d+)\s+0\s+obj[\s\S]*?\/Type\s*\/Page\b/);
    if (pageMatch?.[1]) {
        pageRef = `${pageMatch[1]} 0 R`;
    }

    const signatureDictionary =
        `${signatureObj} 0 obj\n` +
        `<<\n` +
        `/Type /Sig\n` +
        `/Filter /Adobe.PPKLite\n` +
        `/SubFilter /adbe.pkcs7.detached\n` +
        `${byteRangePlaceholder}\n` +
        `/Contents <${signature}>\n` +
        `/Reason (${pdfEscape(reason)})\n` +
        `/M (${pdfDate})\n` +
        `>>\n` +
        `endobj\n`;

    const widgetDictionary =
        `${widgetObj} 0 obj\n` +
        `<<\n` +
        `/Type /Annot\n` +
        `/Subtype /Widget\n` +
        `/FT /Sig\n` +
        `/Rect [0 0 0 0]\n` +
        `/V ${signatureObj} 0 R\n` +
        `/T (Signature1)\n` +
        `/F 132\n` +
        `/P ${pageRef}\n` +
        `>>\n` +
        `endobj\n`;

    const formDictionary =
        `${formObj} 0 obj\n` +
        `<<\n` +
        `/Type /AcroForm\n` +
        `/SigFlags 3\n` +
        `/Fields [${widgetObj} 0 R]\n` +
        `>>\n` +
        `endobj\n`;

    // New Catalog in the incremental section — does not mutate original catalog bytes.
    const catalogDictionary =
        `${catalogObj} 0 obj\n` +
        `<<\n` +
        `/Type /Catalog\n` +
        `/Pages ${pagesRef}\n` +
        `/AcroForm ${formObj} 0 R\n` +
        `>>\n` +
        `endobj\n`;

    const objects =
        signatureDictionary + widgetDictionary + formDictionary + catalogDictionary;

    const prevXrefMatch = originalPdf.match(/startxref\s+(\d+)/g);
    let prevXref = 0;
    if (prevXrefMatch && prevXrefMatch.length > 0) {
        const last = prevXrefMatch[prevXrefMatch.length - 1]!;
        prevXref = Number(last.replace(/startxref\s+/, ""));
    }

    const size = catalogObj + 1;
    const appendStart = originalPdf.length;
    const sigOffset = appendStart + 1; // after leading \n
    const widgetOffset = sigOffset + signatureDictionary.length;
    const formOffset = widgetOffset + widgetDictionary.length;
    const catalogOffset = formOffset + formDictionary.length;

    const startxrefPlaceholder = "9999999999";
    const xrefTable =
        `xref\n` +
        `${signatureObj} 4\n` +
        `${String(sigOffset).padStart(10, "0")} 00000 n \n` +
        `${String(widgetOffset).padStart(10, "0")} 00000 n \n` +
        `${String(formOffset).padStart(10, "0")} 00000 n \n` +
        `${String(catalogOffset).padStart(10, "0")} 00000 n \n`;

    const trailer =
        `trailer\n` +
        `<<\n` +
        `/Size ${size}\n` +
        `/Root ${catalogObj} 0 R\n` +
        (prevXref > 0 ? `/Prev ${prevXref}\n` : "") +
        `>>\n` +
        `startxref\n` +
        `${startxrefPlaceholder}\n` +
        `%%EOF`;

    let combined = originalPdf + "\n" + objects + xrefTable + trailer;

    // IMPORTANT: do NOT locate this via `combined.lastIndexOf("xref\n")` — that
    // substring also occurs inside the literal keyword "startxref\n" further
    // down the file (which is LATER than our real table), so lastIndexOf
    // would resolve to a bogus, self-referential offset and corrupt the
    // whole xref chain (manifests as totally blank pages in strict readers).
    // Compute the offset arithmetically instead, since we know exactly how
    // the string was assembled.
    const xrefPos = appendStart + 1 + objects.length;
    // Keep startxref field width so ByteRange offsets stay valid.
    combined = combined.replace(
        startxrefPlaceholder,
        String(xrefPos).padStart(startxrefPlaceholder.length, "0"),
    );

    // Resolve ByteRange (length-preserving)
    const placeholder = "/ByteRange [0 /********** /********** /**********]";
    const placeholderPos = combined.indexOf(placeholder);
    if (placeholderPos === -1) {
        throw new Error("Failed to locate ByteRange placeholder");
    }

    // Signature /Contents is hex: "/Contents <000...>" — locate near ByteRange.
    const contentsMarker = "/Contents <";
    const contentsPos = combined.indexOf(contentsMarker, placeholderPos);
    if (contentsPos === -1) {
        throw new Error("Failed to locate /Contents placeholder");
    }
    const contentsStart = contentsPos + contentsMarker.length;
    const contentsEnd = contentsStart + SIGNATURE_CONTENTS_HEX_LENGTH;
    const byteRange: PdfByteRange = [
        0,
        contentsStart - 1,
        contentsEnd + 1,
        combined.length - (contentsEnd + 1),
    ];

    let resolved =
        `/ByteRange [${byteRange[0]} ${byteRange[1]} ${byteRange[2]} ${byteRange[3]}]`;
    if (resolved.length < placeholder.length) {
        resolved = resolved.slice(0, -1) + " ".repeat(placeholder.length - resolved.length) + "]";
    } else if (resolved.length > placeholder.length) {
        combined =
            combined.slice(0, placeholderPos) +
            resolved +
            combined.slice(placeholderPos + placeholder.length);
        return finalizeByteRange(bytesFromBinaryString(combined));
    }

    combined =
        combined.slice(0, placeholderPos) +
        resolved +
        combined.slice(placeholderPos + placeholder.length);

    return bytesFromBinaryString(combined);
}

/** Recompute ByteRange after a length-changing rewrite. */
function finalizeByteRange(pdfBytes: Uint8Array): Uint8Array {
    const contentsMarker = encoder("/Contents <");
    const contentsKeywordPos = findSubarray(pdfBytes, contentsMarker);
    if (contentsKeywordPos === -1) throw new Error("Missing /Contents");
    const contentsStart = contentsKeywordPos + contentsMarker.length;
    // Find closing >
    let contentsEnd = contentsStart;
    while (contentsEnd < pdfBytes.length && pdfBytes[contentsEnd] !== 0x3e) contentsEnd++;
    const byteRange: PdfByteRange = [
        0,
        contentsStart - 1,
        contentsEnd + 1,
        pdfBytes.length - (contentsEnd + 1),
    ];
    const byteRangeStr =
        `/ByteRange [${byteRange[0]} ${byteRange[1]} ${byteRange[2]} ${byteRange[3]}]`;

    const pdfStr = binaryStringFromBytes(pdfBytes);
    const match = pdfStr.match(/\/ByteRange\s*\[[^\]]*\]/);
    if (!match || match.index === undefined) throw new Error("Missing /ByteRange");
    let resolved = byteRangeStr;
    if (resolved.length < match[0].length) {
        resolved = resolved.slice(0, -1) + " ".repeat(match[0].length - resolved.length) + "]";
    }
    const updated =
        pdfStr.slice(0, match.index) + resolved + pdfStr.slice(match.index + match[0].length);
    return bytesFromBinaryString(updated);
}

function locateContents(pdfBytes: Uint8Array): {
    byteRange: PdfByteRange;
    contentsOffset: number;
    contentsLength: number;
} {
    const contentsMarker = encoder("/Contents <");
    const pos = findSubarray(pdfBytes, contentsMarker);
    if (pos === -1) throw new Error("PDF missing /Contents <...>");
    const contentsOffset = pos + contentsMarker.length;
    let end = contentsOffset;
    while (end < pdfBytes.length && pdfBytes[end] !== 0x3e) end++;
    const contentsLength = end - contentsOffset;
    const byteRange: PdfByteRange = [
        0,
        contentsOffset - 1,
        end + 1,
        pdfBytes.length - (end + 1),
    ];
    return { byteRange, contentsOffset, contentsLength };
}

function extractByteRangeBytes(pdfBytes: Uint8Array, byteRange: PdfByteRange): Uint8Array {
    const [a, b, c, d] = byteRange;
    const part1 = pdfBytes.slice(a, a + b);
    const part2 = pdfBytes.slice(c, c + d);
    return concatUint8(part1, part2);
}

/**
 * Build PKCS#9 authenticatedAttributes and the hash that the USB token must SignHash.
 */
function buildAuthAttrs(messageDigest: Uint8Array, signingTime: Date = new Date()): {
    authAttrsDer: Uint8Array;
    attrsForSigningDer: Uint8Array;
} {
    const asn1 = forge.asn1;
    const pki = forge.pki;

    const contentType = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.contentType).getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
            asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(pki.oids.data).getBytes(),
            ),
        ]),
    ]);

    const pad2 = (n: number) => n.toString().padStart(2, "0");
    const utc =
        String(signingTime.getUTCFullYear()).slice(-2) +
        pad2(signingTime.getUTCMonth() + 1) +
        pad2(signingTime.getUTCDate()) +
        pad2(signingTime.getUTCHours()) +
        pad2(signingTime.getUTCMinutes()) +
        pad2(signingTime.getUTCSeconds()) +
        "Z";

    const signingTimeAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.signingTime).getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false, utc),
        ]),
    ]);

    const digestStr = Array.from(messageDigest).map((b) => String.fromCharCode(b)).join("");
    const messageDigestAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.messageDigest).getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digestStr),
        ]),
    ]);

    // SET OF Attribute (sorted by DER for DER SET rules — contentType < messageDigest < signingTime by OID)
    // OID order: contentType(1.2.840.113549.1.9.3), messageDigest(...9.4), signingTime(...9.5)
    const attrs = [contentType, messageDigestAttr, signingTimeAttr];

    const attrsSet = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, attrs);
    const authAttrsDerStr = asn1.toDer(attrsSet).getBytes();

    // For signing, authenticatedAttributes use IMPLICIT [0] instead of SET tag
    const attrsForSigning = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, attrs);
    const attrsForSigningDerStr = asn1.toDer(attrsForSigning).getBytes();

    const toBytes = (s: string) => {
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
        return out;
    };

    return {
        authAttrsDer: toBytes(authAttrsDerStr),
        attrsForSigningDer: toBytes(attrsForSigningDerStr),
    };
}

/**
 * Prepare PDF for external USB-token signing (PAdES / adbe.pkcs7.detached).
 */
export async function preparePdfForSigning(
    pdfBytes: Uint8Array,
    options?: {
        subject?: string;
        issuer?: string;
        certificateBase64?: string;
        visualSignature?: VisualSignatureConfig;
        reason?: string;
    },
): Promise<PreparedPdfResult> {
    const withAppearance = await applyVisualAppearance(pdfBytes, {
        subject: options?.subject,
        issuer: options?.issuer,
        certificateBase64: options?.certificateBase64,
        visualSignature: options?.visualSignature,
    });

    const preparedPdf = addSignaturePlaceholder(
        withAppearance,
        options?.visualSignature?.reason ?? options?.reason ?? "Digital Signature",
    );

    const { byteRange, contentsOffset, contentsLength } = locateContents(preparedPdf);
    // Re-write ByteRange to exact values (length-preserving)
    const exact =
        `/ByteRange [${byteRange[0]} ${byteRange[1]} ${byteRange[2]} ${byteRange[3]}]`;
    const pdfStr = binaryStringFromBytes(preparedPdf);
    const brMatch = pdfStr.match(/\/ByteRange\s*\[[^\]]*\]/);
    let finalPdf = preparedPdf;
    if (brMatch && brMatch.index !== undefined) {
        let resolved = exact;
        if (resolved.length < brMatch[0].length) {
            resolved = resolved.slice(0, -1) + " ".repeat(brMatch[0].length - resolved.length) + "]";
        }
        if (resolved.length === brMatch[0].length) {
            const updated =
                pdfStr.slice(0, brMatch.index) +
                resolved +
                pdfStr.slice(brMatch.index + brMatch[0].length);
            finalPdf = bytesFromBinaryString(updated);
        }
    }

    const located = locateContents(finalPdf);
    const dataToDigest = extractByteRangeBytes(finalPdf, located.byteRange);
    const messageDigest = await sha256(dataToDigest);
    const { attrsForSigningDer } = buildAuthAttrs(messageDigest);
    const hashToSign = await sha256(attrsForSigningDer);

    return {
        preparedPdf: finalPdf,
        hashBase64: base64FromBytes(hashToSign),
        byteRange: located.byteRange,
        authAttrsDerBase64: base64FromBytes(attrsForSigningDer),
        contentsOffset: located.contentsOffset,
        contentsLength: located.contentsLength,
    };
}

/**
 * Build adbe.pkcs7.detached CMS SignedData using a precomputed RSA signature from USB token.
 */
export function buildCmsFromExternalSignature(params: {
    certificateBase64: string;
    signatureBase64: string;
    authAttrsDerBase64: string;
}): Uint8Array {
    const asn1 = forge.asn1;
    const pki = forge.pki;

    const certDer = bytesFromBase64(params.certificateBase64);
    const certAsn1 = asn1.fromDer(
        Array.from(certDer).map((b) => String.fromCharCode(b)).join(""),
    );
    const cert = pki.certificateFromAsn1(certAsn1);

    const signatureBytes = bytesFromBase64(params.signatureBase64);
    const signatureStr = Array.from(signatureBytes).map((b) => String.fromCharCode(b)).join("");

    const authAttrsBytes = bytesFromBase64(params.authAttrsDerBase64);
    // authAttrsDerBase64 stores IMPLICIT [0] form used for signing; for embedding in SignerInfo
    // we need the same CONTEXT_SPECIFIC [0] encoding.
    const authAttrsAsn1 = asn1.fromDer(
        Array.from(authAttrsBytes).map((b) => String.fromCharCode(b)).join(""),
    );

    // issuerAndSerialNumber from TBSCertificate ASN.1
    const tbs = (certAsn1.value as forge.asn1.Asn1[])[0]!;
    const tbsValues = tbs.value as forge.asn1.Asn1[];
    // TBSCertificate: [version?], serialNumber, signature, issuer, validity, subject, ...
    let issuerNode: forge.asn1.Asn1;
    let serialNode: forge.asn1.Asn1;
    if (tbsValues[0] && tbsValues[0].tagClass === asn1.Class.CONTEXT_SPECIFIC) {
        serialNode = tbsValues[1]!;
        issuerNode = tbsValues[3]!;
    } else {
        serialNode = tbsValues[0]!;
        issuerNode = tbsValues[2]!;
    }
    void cert; // cert parsed to validate DER; issuer/serial taken from ASN.1

    const issuerAndSerialNumber = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        issuerNode,
        serialNode,
    ]);

    const sha256Oid = pki.oids.sha256 ?? "2.16.840.1.101.3.4.2.1";
    const sha256WithRsaOid = pki.oids.sha256WithRSAEncryption ?? "1.2.840.113549.1.1.11";

    const digestAlgorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(sha256Oid).getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
    ]);

    const signatureAlgorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(sha256WithRsaOid).getBytes(),
        ),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
    ]);

    const signerInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(1)), // version
        issuerAndSerialNumber,
        digestAlgorithm,
        authAttrsAsn1, // already [0] IMPLICIT
        signatureAlgorithm,
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, signatureStr),
    ]);

    const digestAlgorithms = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        digestAlgorithm,
    ]);

    const contentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.data).getBytes(),
        ),
        // detached: no content
    ]);

    const certificates = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [certAsn1]);

    const signerInfos = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [signerInfo]);

    const signedData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, String.fromCharCode(1)),
        digestAlgorithms,
        contentInfo,
        certificates,
        signerInfos,
    ]);

    const contentInfoWrapper = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(pki.oids.signedData).getBytes(),
        ),
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData]),
    ]);

    const derStr = asn1.toDer(contentInfoWrapper).getBytes();
    const out = new Uint8Array(derStr.length);
    for (let i = 0; i < derStr.length; i++) out[i] = derStr.charCodeAt(i) & 0xff;
    return out;
}

/**
 * Embed CMS DER into the prepared PDF /Contents placeholder (length-preserving hex).
 */
export function embedSignatureInPreparedPdf(
    preparedPdf: Uint8Array,
    cmsDer: Uint8Array,
    contentsOffset?: number,
    contentsLength?: number,
): Uint8Array {
    const located = contentsOffset !== undefined && contentsLength !== undefined
        ? { contentsOffset, contentsLength }
        : locateContents(preparedPdf);

    const hex = Array.from(cmsDer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    if (hex.length > located.contentsLength) {
        throw new Error(
            `CMS signature too large (${hex.length} hex chars > reserved ${located.contentsLength}). Increase placeholder size.`,
        );
    }
    const padded = hex + "0".repeat(located.contentsLength - hex.length);

    const out = new Uint8Array(preparedPdf);
    for (let i = 0; i < padded.length; i++) {
        out[located.contentsOffset + i] = padded.charCodeAt(i) & 0xff;
    }
    return out;
}

/**
 * High-level: create signed PDF from prepared bytes + token signature + cert.
 */
export function createSignedPdfFromPrepared(params: {
    preparedPdf: Uint8Array;
    signatureBase64: string;
    certificateBase64: string;
    authAttrsDerBase64: string;
    contentsOffset: number;
    contentsLength: number;
}): Uint8Array {
    const cms = buildCmsFromExternalSignature({
        certificateBase64: params.certificateBase64,
        signatureBase64: params.signatureBase64,
        authAttrsDerBase64: params.authAttrsDerBase64,
    });
    return embedSignatureInPreparedPdf(
        params.preparedPdf,
        cms,
        params.contentsOffset,
        params.contentsLength,
    );
}

/** @deprecated Prefer prepare + createSignedPdfFromPrepared. Kept for transitional callers. */
export async function createSignedPdfFromOriginal(
    originalPdfBytes: Uint8Array,
    signatureBase64: string,
    signerInfo?: {
        subject?: string;
        issuer?: string;
        certificateBase64?: string;
        authAttrsDerBase64?: string;
        visualSignature?: VisualSignatureConfig;
    },
): Promise<Uint8Array> {
    if (signerInfo?.certificateBase64 && signerInfo?.authAttrsDerBase64) {
        // Unexpected path — should use prepared PDF. Fall through to visual-only if no prepared.
    }
    // Visual-only fallback is no longer used for real signing.
    return await applyVisualAppearance(originalPdfBytes, signerInfo);
}

export async function verifySignedPdf(pdfBytes: Uint8Array): Promise<PdfSignatureVerification> {
    try {
        const located = locateContents(pdfBytes);
        const hexChars: number[] = [];
        for (let i = 0; i < located.contentsLength; i++) {
            const c = pdfBytes[located.contentsOffset + i]!;
            if (c === 0x30 /* '0' */ && hexChars.length > 0) {
                // trailing padding zeros are fine; stop collecting once we hit pure padding after CMS
            }
            hexChars.push(c);
        }
        let hex = String.fromCharCode(...hexChars).replace(/0+$/, "");
        if (hex.length % 2 === 1) hex += "0";
        if (hex.length < 10) {
            return { valid: false, reason: "Empty signature Contents" };
        }

        const cmsBytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < cmsBytes.length; i++) {
            cmsBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }

        const asn1 = forge.asn1;
        const pki = forge.pki;
        const derStr = Array.from(cmsBytes).map((b) => String.fromCharCode(b)).join("");
        const cmsAsn1 = asn1.fromDer(derStr);

        // ContentInfo → SignedData
        const contentInfoValues = cmsAsn1.value as forge.asn1.Asn1[];
        const signedDataWrapper = contentInfoValues[1]!;
        const signedData = (signedDataWrapper.value as forge.asn1.Asn1[])[0]!;
        const sdValues = signedData.value as forge.asn1.Asn1[];

        // certificates [0]
        let certAsn1: forge.asn1.Asn1 | undefined;
        for (const node of sdValues) {
            if (node.tagClass === asn1.Class.CONTEXT_SPECIFIC && node.type === 0) {
                certAsn1 = (node.value as forge.asn1.Asn1[])[0];
                break;
            }
        }

        let certificateSubject: string | undefined;
        let certificateIssuer: string | undefined;
        if (certAsn1) {
            try {
                const cert = pki.certificateFromAsn1(certAsn1);
                certificateSubject = cert.subject.getField("CN")?.value ?? cert.subject.attributes
                    .map((a: any) => `${a.shortName}=${a.value}`)
                    .join(", ");
                certificateIssuer = cert.issuer.getField("CN")?.value ?? cert.issuer.attributes
                    .map((a: any) => `${a.shortName}=${a.value}`)
                    .join(", ");
            } catch {
                // ignore parse errors
            }
        }

        // Recompute message digest from ByteRange
        const dataToDigest = extractByteRangeBytes(pdfBytes, located.byteRange);
        const messageDigest = await sha256(dataToDigest);

        // Find signerInfos SET — last element typically
        const signerInfos = sdValues[sdValues.length - 1]!;
        const signerInfo = (signerInfos.value as forge.asn1.Asn1[])[0]!;
        const siValues = signerInfo.value as forge.asn1.Asn1[];

        // authenticatedAttributes is CONTEXT_SPECIFIC 0
        let authAttrsNode: forge.asn1.Asn1 | undefined;
        let encryptedDigestNode: forge.asn1.Asn1 | undefined;
        for (const node of siValues) {
            if (node.tagClass === asn1.Class.CONTEXT_SPECIFIC && node.type === 0) {
                authAttrsNode = node;
            }
            if (node.tagClass === asn1.Class.UNIVERSAL && node.type === asn1.Type.OCTETSTRING) {
                encryptedDigestNode = node;
            }
        }

        if (!authAttrsNode || !encryptedDigestNode || !certAsn1) {
            return {
                valid: false,
                reason: "CMS missing authenticatedAttributes, signature, or certificate",
                certificateSubject,
                certificateIssuer,
            };
        }

        // Extract messageDigest from authAttrs and compare
        const attrSet = authAttrsNode.value as forge.asn1.Asn1[];
        let embeddedDigest: Uint8Array | undefined;
        for (const attr of attrSet) {
            const seq = attr.value as forge.asn1.Asn1[];
            const oidBytes = seq[0]?.value as string;
            const oid = asn1.derToOid(oidBytes);
            if (oid === pki.oids.messageDigest) {
                const setNode = seq[1]!;
                const octet = (setNode.value as forge.asn1.Asn1[])[0]!;
                const digStr = octet.value as string;
                embeddedDigest = new Uint8Array(digStr.length);
                for (let i = 0; i < digStr.length; i++) {
                    embeddedDigest[i] = digStr.charCodeAt(i) & 0xff;
                }
            }
        }

        if (!embeddedDigest || embeddedDigest.length !== messageDigest.length) {
            return {
                valid: false,
                reason: "messageDigest attribute missing or length mismatch",
                certificateSubject,
                certificateIssuer,
            };
        }
        for (let i = 0; i < messageDigest.length; i++) {
            if (embeddedDigest[i] !== messageDigest[i]) {
                return {
                    valid: false,
                    reason: "PDF ByteRange digest does not match CMS messageDigest",
                    certificateSubject,
                    certificateIssuer,
                };
            }
        }

        // Verify RSA signature over authenticatedAttributes
        const authAttrsDerStr = asn1.toDer(authAttrsNode).getBytes();
        const md = forge.md.sha256.create();
        md.update(authAttrsDerStr);

        const cert = pki.certificateFromAsn1(certAsn1);
        const sigStr = encryptedDigestNode.value as string;
        const ok = (cert.publicKey as forge.pki.rsa.PublicKey).verify(
            md.digest().getBytes(),
            sigStr,
        );

        return {
            valid: Boolean(ok),
            reason: ok ? undefined : "RSA signature verification failed",
            certificateSubject,
            certificateIssuer,
            signedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            valid: false,
            reason: err instanceof Error ? err.message : "Verification failed",
        };
    }
}

export async function computePreparedPdfHash(originalPdfBytes: Uint8Array): Promise<string> {
    const hash = await sha256(originalPdfBytes);
    return base64FromBytes(hash);
}

export { SIGNATURE_CONTENTS_HEX_LENGTH };
