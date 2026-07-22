/** Namespace permission_key cho phân quyền xem trường metadata kho. */
export const ARCHIVE_METADATA_VIEW_PREFIX = "archive.metadata.view.";

export const ARCHIVE_METADATA_VIEW_SLOT_PREFIX = `${ARCHIVE_METADATA_VIEW_PREFIX}slot.`;
export const ARCHIVE_METADATA_VIEW_FIELD_PREFIX = `${ARCHIVE_METADATA_VIEW_PREFIX}field.`;

export function isArchiveMetadataViewPermissionKey(key: string): boolean {
    return key.startsWith(ARCHIVE_METADATA_VIEW_PREFIX);
}

export function encodeMetadataFieldPattern(pattern: string): string {
    return Buffer.from(pattern, "utf8").toString("base64url");
}

export function decodeMetadataFieldPattern(encoded: string): string {
    return Buffer.from(encoded, "base64url").toString("utf8");
}

export function buildMetadataViewSlotKey(slotCode: string): string {
    return `${ARCHIVE_METADATA_VIEW_SLOT_PREFIX}${slotCode}`;
}

export function buildMetadataViewFieldKey(slotCode: string, fieldPattern: string): string {
    return `${ARCHIVE_METADATA_VIEW_FIELD_PREFIX}${slotCode}.${encodeMetadataFieldPattern(fieldPattern)}`;
}

export function parseMetadataViewFieldKey(permissionKey: string): {
    slotCode: string;
    fieldPattern: string;
} | null {
    if (!permissionKey.startsWith(ARCHIVE_METADATA_VIEW_FIELD_PREFIX)) {
        return null;
    }
    const rest = permissionKey.slice(ARCHIVE_METADATA_VIEW_FIELD_PREFIX.length);
    const dotIdx = rest.indexOf(".");
    if (dotIdx <= 0) return null;
    const slotCode = rest.slice(0, dotIdx);
    const encoded = rest.slice(dotIdx + 1);
    if (!slotCode || !encoded) return null;
    try {
        return { slotCode, fieldPattern: decodeMetadataFieldPattern(encoded) };
    } catch {
        return null;
    }
}

export function parseMetadataViewSlotKey(permissionKey: string): string | null {
    if (!permissionKey.startsWith(ARCHIVE_METADATA_VIEW_SLOT_PREFIX)) {
        return null;
    }
    const slotCode = permissionKey.slice(ARCHIVE_METADATA_VIEW_SLOT_PREFIX.length);
    return slotCode || null;
}
