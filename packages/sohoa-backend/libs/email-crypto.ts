import { env } from "../env.ts";

async function deriveKey(secret: string): Promise<CryptoKey> {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
    );
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export async function encryptPassword(plain: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(env.SECRET_KEY);
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(plain),
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return bytesToBase64(combined);
}

export async function decryptPassword(encoded: string): Promise<string> {
    const combined = base64ToBytes(encoded);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const key = await deriveKey(env.SECRET_KEY);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(decrypted);
}
