const SIGNATURE_HEX_LENGTH = 8192;
const BYTE_RANGE_PLACEHOLDER = "/ByteRange [0 ********** ********** **********]";

export type PdfByteRange = [number, number, number, number];

export interface PreparedPdfResult {
    preparedPdf: Uint8Array;
    hashBase64: string;
    byteRange: PdfByteRange;
}

export interface PdfSignatureVerification {
    valid: boolean;
    reason?: string;
    certificateSubject?: string;
    certificateIssuer?: string;
    signedAt?: string;
}

function encodeLatin1(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return bytes;
}

function decodeLatin1(bytes: Uint8Array): string {
    let result = "";
    for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i]!);
    }
    return result;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function base64ToBytes(base64: string): Uint8Array {
    const normalized = base64.replace(/\s/g, "");
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function base64FromBytes(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
    const copy = new Uint8Array(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return new Uint8Array(digest);
}

function padByteRangeValue(value: number): string {
    return String(value).padStart(10, "0");
}

function buildIncrementalSignatureUpdate(basePdf: string): string {
    const now = new Date();
    const placeholder = "0".repeat(SIGNATURE_HEX_LENGTH);
    const xrefStart = basePdf.length;

    const signatureObject = [
        "1 0 obj",
        "<<",
        " /Type /Sig",
        " /Filter /Adobe.PPKLite",
        " /SubFilter /adbe.pkcs7.detached",
        " /Name (Sohoa Digital Sign)",
        ` /M (D:${formatPdfDate(now)})`,
        ` /Contents <${placeholder}>`,
        ` ${BYTE_RANGE_PLACEHOLDER}`,
        ">>",
        "endobj",
        "",
        "xref",
        "0 2",
        "0000000000 65535 f ",
        `${padByteRangeValue(xrefStart)} 00000 n `,
        "trailer",
        "<<",
        " /Size 2",
        " /Root 1 0 R",
        ">>",
        "startxref",
        `${xrefStart}`,
        "%%EOF",
    ].join("\n");

    return basePdf + signatureObject;
}

function formatPdfDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate()),
        pad(date.getUTCHours()),
        pad(date.getUTCMinutes()),
        pad(date.getUTCSeconds()),
        "Z",
    ].join("");
}

function resolveContentsRange(pdfText: string): {
    hexStart: number
    hexEnd: number
} | null {
    const marker = "/Contents <";
    const markerIndex = pdfText.lastIndexOf(marker);
    if (markerIndex < 0) return null;

    const hexStart = markerIndex + marker.length;
    const hexEnd = pdfText.indexOf(">", hexStart);
    if (hexEnd < 0) return null;

    return { hexStart, hexEnd };
}

function applyByteRange(pdfText: string, byteRange: PdfByteRange): string {
    const [rangeStart, rangeLen1, rangeStart2, rangeLen2] = byteRange;
    const replacement = `/ByteRange [${rangeStart} ${rangeLen1} ${rangeStart2} ${rangeLen2}]`;
    return pdfText.replace(BYTE_RANGE_PLACEHOLDER, replacement);
}

async function computeByteRangeHash(pdfBytes: Uint8Array, byteRange: PdfByteRange): Promise<Uint8Array> {
    const [rangeStart, rangeLen1, rangeStart2, rangeLen2] = byteRange;
    const part1 = pdfBytes.slice(rangeStart, rangeStart + rangeLen1);
    const part2 = pdfBytes.slice(rangeStart2, rangeStart2 + rangeLen2);
    const merged = new Uint8Array(part1.length + part2.length);
    merged.set(part1, 0);
    merged.set(part2, part1.length);
    return await sha256(merged);
}

export async function preparePdfForSigning(pdfBytes: Uint8Array): Promise<PreparedPdfResult> {
    let basePdf = decodeLatin1(pdfBytes).replace(/\r\n/g, "\n");
    if (!basePdf.endsWith("\n")) {
        basePdf += "\n";
    }

    let preparedText = buildIncrementalSignatureUpdate(basePdf);
    const contentsRange = resolveContentsRange(preparedText);
    if (!contentsRange) {
        throw new Error("Unable to locate signature placeholder in prepared PDF");
    }

    const byteRange: PdfByteRange = [
        0,
        contentsRange.hexStart,
        contentsRange.hexEnd,
        preparedText.length - contentsRange.hexEnd,
    ];

    preparedText = applyByteRange(preparedText, byteRange);
    const preparedPdf = encodeLatin1(preparedText);
    const hash = await computeByteRangeHash(preparedPdf, byteRange);

    return {
        preparedPdf,
        hashBase64: base64FromBytes(hash),
        byteRange,
    };
}

export function embedSignatureInPreparedPdf(
    preparedPdf: Uint8Array,
    signatureBase64: string,
): Uint8Array {
    const signatureDer = base64ToBytes(signatureBase64);
    const signatureHex = bytesToHex(signatureDer).toUpperCase();
    if (signatureHex.length > SIGNATURE_HEX_LENGTH) {
        throw new Error("Signature exceeds PDF placeholder size");
    }

    const paddedHex = signatureHex.padEnd(SIGNATURE_HEX_LENGTH, "0");
    const pdfText = decodeLatin1(preparedPdf);
    const contentsRange = resolveContentsRange(pdfText);
    if (!contentsRange) {
        throw new Error("Unable to locate signature placeholder in prepared PDF");
    }

    const updatedText =
        pdfText.slice(0, contentsRange.hexStart) +
        paddedHex +
        pdfText.slice(contentsRange.hexEnd);

    return encodeLatin1(updatedText);
}

export async function verifySignedPdf(pdfBytes: Uint8Array): Promise<PdfSignatureVerification> {
    const pdfText = decodeLatin1(pdfBytes);
    const byteRangeMatch = pdfText.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
    const contentsMatch = pdfText.match(/\/Contents\s*<([0-9A-Fa-f]*)>/);

    if (!byteRangeMatch || !contentsMatch) {
        return { valid: false, reason: "PDF does not contain a digital signature" };
    }

    const byteRange: PdfByteRange = [
        Number(byteRangeMatch[1]),
        Number(byteRangeMatch[2]),
        Number(byteRangeMatch[3]),
        Number(byteRangeMatch[4]),
    ];

    const signatureHex = contentsMatch[1]!.replace(/0+$/, "");
    if (!signatureHex) {
        return { valid: false, reason: "Signature placeholder is empty" };
    }

    try {
        await computeByteRangeHash(pdfBytes, byteRange);
        const forge = await import("node-forge");
        const signatureDer = forge.util.hexToBytes(signatureHex);
        const asn1 = forge.asn1.fromDer(signatureDer);
        const p7 = forge.pkcs7.messageFromAsn1(asn1);

        const signer = p7.certificates?.[0];
        const subject = signer?.subject.attributes
            .map((attr: { shortName?: string; value?: string }) => `${attr.shortName}=${attr.value}`)
            .join(", ");
        const issuer = signer?.issuer.attributes
            .map((attr: { shortName?: string; value?: string }) => `${attr.shortName}=${attr.value}`)
            .join(", ");

        return {
            valid: Boolean(p7.certificates?.length),
            certificateSubject: subject,
            certificateIssuer: issuer,
        };
    } catch (error) {
        return {
            valid: false,
            reason: error instanceof Error ? error.message : "Unable to verify signature",
        };
    }
}

export async function createSignedPdfFromOriginal(
    originalPdfBytes: Uint8Array,
    signatureBase64: string,
): Promise<Uint8Array> {
    const prepared = await preparePdfForSigning(originalPdfBytes);
    return embedSignatureInPreparedPdf(prepared.preparedPdf, signatureBase64);
}

export async function computePreparedPdfHash(originalPdfBytes: Uint8Array): Promise<string> {
    const prepared = await preparePdfForSigning(originalPdfBytes);
    return prepared.hashBase64;
}
