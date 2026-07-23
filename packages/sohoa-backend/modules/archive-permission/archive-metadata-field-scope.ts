import { and, eq, inArray, like } from "drizzle-orm";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { db } from "../../db/db-conn.ts";
import { archiveAclEntries } from "../../db/schemas/archive-acl.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { userRolesHavePermission } from "../auth/permission-resolver.ts";
import {
    expandPatternToCatalogKeys,
} from "../../libs/metadata-template.ts";
import {
    ARCHIVE_METADATA_VIEW_PREFIX,
    parseMetadataViewFieldKey,
    parseMetadataViewSlotKey,
} from "./archive-metadata-acl-keys.ts";

function roleIdsOf(profile: UserWithRoles): string[] {
    return profile.userRoles.map((ur) => ur.role.id);
}

function isFieldAllowedByPatterns(
    fieldKey: string,
    patterns: string[],
    catalogKeys: string[],
): boolean {
    for (const pattern of patterns) {
        const keys = expandPatternToCatalogKeys(pattern, catalogKeys);
        if (keys.includes(fieldKey)) return true;
    }
    return false;
}

/**
 * Trả null = chưa cấu hình ma trận metadata cho loại TL → không lọc thêm.
 * Trả [] = đã cấu hình nhưng user không được xem trường nào.
 */
export async function resolveMetadataViewFieldPatterns(
    profile: UserWithRoles,
    documentTypeId: string,
    catalogKeys: string[],
): Promise<string[] | null> {
    if (userRolesHavePermission(profile.userRoles, Permission.SEARCH_GLOBAL)) {
        return null;
    }

    const entries = await db.query.archiveAclEntries.findMany({
        where: and(
            eq(archiveAclEntries.resourceKind, "document_type"),
            eq(archiveAclEntries.resourceId, documentTypeId),
            like(archiveAclEntries.permissionKey, `${ARCHIVE_METADATA_VIEW_PREFIX}%`),
        ),
        with: { principals: true },
    });

    if (entries.length === 0) return null;

    const roleIds = roleIdsOf(profile);
    const matchedSlotCodes = new Set<string>();
    for (const entry of entries) {
        const slotCode = parseMetadataViewSlotKey(entry.permissionKey);
        if (!slotCode) continue;
        const matches = entry.principals.some((p) => {
            if (p.principalKind === "user" && p.principalId === profile.id) return true;
            if (p.principalKind === "role" && roleIds.includes(p.principalId)) return true;
            return false;
        });
        if (matches) matchedSlotCodes.add(slotCode);
    }

    if (matchedSlotCodes.size === 0) return [];

    const patterns = new Set<string>();
    for (const entry of entries) {
        const parsed = parseMetadataViewFieldKey(entry.permissionKey);
        if (!parsed) continue;
        if (matchedSlotCodes.has(parsed.slotCode)) {
            patterns.add(parsed.fieldPattern);
        }
    }

    if (patterns.size === 0) return [];

    return [...patterns];
}

export async function resolveMetadataViewAllowedFieldKeys(
    profile: UserWithRoles,
    documentTypeId: string,
    catalogKeys: string[],
): Promise<string[] | null> {
    const patterns = await resolveMetadataViewFieldPatterns(
        profile,
        documentTypeId,
        catalogKeys,
    );
    if (patterns === null) return null;
    if (patterns.length === 0) return [];

    const allowed = new Set<string>();
    for (const key of catalogKeys) {
        if (isFieldAllowedByPatterns(key, patterns, catalogKeys)) {
            allowed.add(key);
        }
    }
    return [...allowed];
}

export async function resolveMetadataViewAccessForDocumentTypes(
    profile: UserWithRoles,
    documentTypeIds: string[],
    catalogKeysByDocType: Map<string, string[]>,
): Promise<Record<string, string[] | null>> {
    const result: Record<string, string[] | null> = {};
    const uniqueIds = [...new Set(documentTypeIds.filter(Boolean))];
    await Promise.all(
        uniqueIds.map(async (docTypeId) => {
            const catalogKeys = catalogKeysByDocType.get(docTypeId) ?? [];
            result[docTypeId] = await resolveMetadataViewAllowedFieldKeys(
                profile,
                docTypeId,
                catalogKeys,
            );
        }),
    );
    return result;
}
