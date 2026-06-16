function sanitizeZipEntryName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "document.pdf";
}

async function computeSha256(data: Uint8Array): Promise<string> {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function uniqueZipEntryName(fileName: string, usedNames: Set<string>): string {
    const safeName = sanitizeZipEntryName(fileName);
    if (!usedNames.has(safeName)) {
        usedNames.add(safeName);
        return safeName;
    }

    const dotIndex = safeName.lastIndexOf(".");
    const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
    const ext = dotIndex > 0 ? safeName.slice(dotIndex) : "";

    let counter = 2;
    while (usedNames.has(`${base} (${counter})${ext}`)) {
        counter++;
    }

    const uniqueName = `${base} (${counter})${ext}`;
    usedNames.add(uniqueName);
    return uniqueName;
}

export async function buildManifestLines(
    entries: Array<{ path: string; data: Uint8Array }>,
): Promise<string[]> {
    const lines: string[] = [];
    for (const entry of entries) {
        const hash = await computeSha256(entry.data);
        lines.push(`${hash}  ${entry.path}`);
    }
    return lines;
}

export function encodeUtf8(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}
