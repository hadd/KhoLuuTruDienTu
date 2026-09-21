import { createHmac } from "node:crypto";

export type PageLicensePayload = {
    v: 1;
    customer: string;
    pageLimit: number;
    issuedAt: string;
    licenseId: string;
    macSalt: string;
};

export type PageLicenseFile = {
    payload: PageLicensePayload;
    sig: string;
};

export class LicenseCryptoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LicenseCryptoError";
    }
}

function bytesToB64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
    const trimmed = b64.trim();
    if (!trimmed) {
        throw new LicenseCryptoError("Chuỗi base64 rỗng");
    }
    try {
        const binary = atob(trimmed);
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    } catch {
        throw new LicenseCryptoError("Chuỗi base64 không hợp lệ");
    }
}

export function canonicalizeLicensePayload(payload: PageLicensePayload): string {
    return JSON.stringify({
        v: payload.v,
        customer: payload.customer,
        pageLimit: payload.pageLimit,
        issuedAt: payload.issuedAt,
        licenseId: payload.licenseId,
        macSalt: payload.macSalt,
    });
}

function pemWrap(label: string, der: Uint8Array): string {
    const b64 = bytesToB64(der);
    const lines = b64.match(/.{1,64}/g) ?? [b64];
    return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function pemUnwrap(pem: string): Uint8Array {
    const body = pem
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s+/g, "");
    return b64ToBytes(body);
}

export async function generatePageQuotaKeyPair(): Promise<{
    privatePem: string;
    publicKeyB64: string;
}> {
    const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    return {
        privatePem: pemWrap("PRIVATE KEY", pkcs8),
        publicKeyB64: bytesToB64(rawPub),
    };
}

export async function signLicensePayload(
    payload: PageLicensePayload,
    privatePem: string,
): Promise<PageLicenseFile> {
    const key = await crypto.subtle.importKey(
        "pkcs8",
        pemUnwrap(privatePem),
        "Ed25519",
        false,
        ["sign"],
    );
    const encoded = new TextEncoder().encode(canonicalizeLicensePayload(payload));
    const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", key, encoded));
    return { payload, sig: bytesToB64(sig) };
}

export async function verifyLicenseFile(
    file: PageLicenseFile,
    publicKeyB64: string,
): Promise<boolean> {
    try {
        const key = await crypto.subtle.importKey(
            "raw",
            b64ToBytes(publicKeyB64),
            "Ed25519",
            false,
            ["verify"],
        );
        const encoded = new TextEncoder().encode(canonicalizeLicensePayload(file.payload));
        return await crypto.subtle.verify(
            "Ed25519",
            key,
            b64ToBytes(file.sig),
            encoded,
        );
    } catch (error) {
        if (error instanceof LicenseCryptoError) {
            throw error;
        }
        return false;
    }
}

export function hmacUsedPages(macSaltB64: string, usedPages: number): string {
    return createHmac("sha256", Buffer.from(b64ToBytes(macSaltB64)))
        .update(String(usedPages))
        .digest("hex");
}

export function hmacUsedPagesOk(
    macSaltB64: string,
    usedPages: number,
    hmac: string | null | undefined,
): boolean {
    if (!hmac) return false;
    const expected = hmacUsedPages(macSaltB64, usedPages);
    if (expected.length !== hmac.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ hmac.charCodeAt(i);
    }
    return diff === 0;
}

export function randomMacSaltB64(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToB64(bytes);
}

export function parseLicenseFile(raw: unknown): PageLicenseFile {
    if (!raw || typeof raw !== "object") {
        throw new Error("Invalid license file");
    }
    const obj = raw as Record<string, unknown>;
    const payloadRaw = obj.payload;
    const sig = obj.sig;
    if (!payloadRaw || typeof payloadRaw !== "object" || typeof sig !== "string" || !sig.trim()) {
        throw new Error("Invalid license file");
    }
    const p = payloadRaw as Record<string, unknown>;
    const pageLimit = Number(p.pageLimit);
    if (
        p.v !== 1 ||
        typeof p.customer !== "string" ||
        !p.customer.trim() ||
        !Number.isFinite(pageLimit) ||
        pageLimit < 1 ||
        !Number.isInteger(pageLimit) ||
        typeof p.issuedAt !== "string" ||
        typeof p.licenseId !== "string" ||
        typeof p.macSalt !== "string"
    ) {
        throw new Error("Invalid license payload");
    }
    return {
        payload: {
            v: 1,
            customer: p.customer.trim(),
            pageLimit,
            issuedAt: p.issuedAt,
            licenseId: p.licenseId,
            macSalt: p.macSalt,
        },
        sig: sig.trim(),
    };
}

export function licenseFileToJson(file: PageLicenseFile): string {
    return `${JSON.stringify({ payload: file.payload, sig: file.sig }, null, 2)}\n`;
}
