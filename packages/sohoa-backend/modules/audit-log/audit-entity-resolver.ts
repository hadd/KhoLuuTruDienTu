import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { folders } from "../../db/schemas/folder.ts";
import { metadataTemplates } from "../../db/schemas/metadata_template.ts";
import { physicalWarehouseItems } from "../../db/schemas/physical-warehouse-item.ts";
import { roles } from "../../db/schemas/role.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import type { ApiAuditLog } from "../../db/schemas/api-audit-log.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { formatDossierLabel } from "./warehouse-audit.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuditLogEntityInfo = {
    type: string;
    id: string;
    label: string;
    exists: boolean;
    link?: string | null;
};

type EntityResolveResult = {
    label: string;
    exists: boolean;
    link?: string | null;
};

type EntityResolver = (ids: string[]) => Promise<Map<string, EntityResolveResult>>;

async function resolveDossiers(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    const map = new Map<string, EntityResolveResult>();
    if (validIds.length === 0) return map;

    const rows = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            folderPath: dossiers.folderPath,
            deletedAt: dossiers.deletedAt,
        })
        .from(dossiers)
        .where(inArray(dossiers.id, validIds));

    for (const row of rows) {
        map.set(row.id, {
            label: formatDossierLabel(row),
            exists: !row.deletedAt,
        });
    }
    return map;
}

async function resolveDossierFiles(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    const map = new Map<string, EntityResolveResult>();
    if (validIds.length === 0) return map;

    const rows = await db
        .select({
            id: dossierFiles.id,
            fileName: dossierFiles.fileName,
        })
        .from(dossierFiles)
        .where(inArray(dossierFiles.id, validIds));

    for (const row of rows) {
        map.set(row.id, {
            label: row.fileName,
            exists: true,
        });
    }
    return map;
}

async function resolveUsers(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    const map = new Map<string, EntityResolveResult>();
    if (validIds.length === 0) return map;

    const rows = await db
        .select({
            id: userProfiles.id,
            fullName: userProfiles.fullName,
            email: userProfiles.email,
            deletedAt: userProfiles.deletedAt,
        })
        .from(userProfiles)
        .where(inArray(userProfiles.id, validIds));

    for (const row of rows) {
        const label = row.fullName?.trim() || row.email || row.id;
        map.set(row.id, {
            label,
            exists: !row.deletedAt,
        });
    }
    return map;
}

async function resolveRoles(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const map = new Map<string, EntityResolveResult>();
    if (ids.length === 0) return map;

    const rows = await db
        .select({
            id: roles.id,
            name: roles.name,
            deletedAt: roles.deletedAt,
        })
        .from(roles)
        .where(inArray(roles.id, ids));

    for (const row of rows) {
        map.set(row.id, {
            label: row.name,
            exists: !row.deletedAt,
        });
    }
    return map;
}

async function resolveFolders(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    const map = new Map<string, EntityResolveResult>();
    if (validIds.length === 0) return map;

    const rows = await db
        .select({
            id: folders.id,
            folderName: folders.folderName,
            folderPath: folders.folderPath,
            deletedAt: folders.deletedAt,
        })
        .from(folders)
        .where(inArray(folders.id, validIds));

    for (const row of rows) {
        map.set(row.id, {
            label: row.folderName || row.folderPath,
            exists: !row.deletedAt,
        });
    }
    return map;
}

async function resolvePhysicalWarehouseItems(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    const map = new Map<string, EntityResolveResult>();
    if (validIds.length === 0) return map;

    const rows = await db
        .select({
            id: physicalWarehouseItems.id,
            name: physicalWarehouseItems.name,
        })
        .from(physicalWarehouseItems)
        .where(inArray(physicalWarehouseItems.id, validIds));

    for (const row of rows) {
        map.set(row.id, {
            label: row.name,
            exists: true,
        });
    }
    return map;
}

async function resolveMetadataTemplates(ids: string[]): Promise<Map<string, EntityResolveResult>> {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    const map = new Map<string, EntityResolveResult>();
    if (validIds.length === 0) return map;

    const rows = await db
        .select({
            id: metadataTemplates.id,
            name: metadataTemplates.name,
            deletedAt: metadataTemplates.deletedAt,
        })
        .from(metadataTemplates)
        .where(inArray(metadataTemplates.id, validIds));

    for (const row of rows) {
        map.set(row.id, {
            label: row.name,
            exists: !row.deletedAt,
        });
    }
    return map;
}

const ENTITY_RESOLVERS: Record<string, EntityResolver> = {
    dossier: resolveDossiers,
    dossier_file: resolveDossierFiles,
    user: resolveUsers,
    role: resolveRoles,
    folder: resolveFolders,
    physical_warehouse_item: resolvePhysicalWarehouseItems,
    metadata_template: resolveMetadataTemplates,
    metadata_permission_config: resolveMetadataTemplates,
    metadata_export_preset: resolveMetadataTemplates,
    document_naming_config: resolveMetadataTemplates,
};

function buildEntityInfo(
    record: ApiAuditLog,
    resolved?: EntityResolveResult,
): AuditLogEntityInfo | null {
    if (!record.entityType || !record.entityId) return null;

    const snapshotLabel = record.entityLabel?.trim();
    const liveLabel = resolved?.label?.trim();
    const label = snapshotLabel || liveLabel || null;
    if (!label) return null;

    return {
        type: record.entityType,
        id: record.entityId,
        label,
        exists: resolved?.exists ?? false,
        link: resolved?.link ?? null,
    };
}

export async function enrichAuditLogRecords<T extends ApiAuditLog>(
    records: T[],
): Promise<Array<T & { entity: AuditLogEntityInfo | null }>> {
    if (records.length === 0) return [];

    const grouped = new Map<string, Set<string>>();
    for (const record of records) {
        if (!record.entityType || !record.entityId) continue;
        const ids = grouped.get(record.entityType) ?? new Set<string>();
        ids.add(record.entityId);
        grouped.set(record.entityType, ids);
    }

    const resolvedByType = new Map<string, Map<string, EntityResolveResult>>();
    await Promise.all(
        [...grouped.entries()].map(async ([entityType, ids]) => {
            const resolver = ENTITY_RESOLVERS[entityType];
            if (!resolver) return;
            const resolved = await resolver([...ids]);
            resolvedByType.set(entityType, resolved);
        }),
    );

    return records.map((record) => {
        const resolved = record.entityType && record.entityId
            ? resolvedByType.get(record.entityType)?.get(record.entityId)
            : undefined;
        return {
            ...record,
            entity: buildEntityInfo(record, resolved),
        };
    });
}

export async function enrichAuditLogRecord<T extends ApiAuditLog>(
    record: T,
): Promise<T & { entity: AuditLogEntityInfo | null }> {
    const [enriched] = await enrichAuditLogRecords([record]);
    return enriched;
}

export async function loadDossierLabelForAudit(dossierId: string): Promise<string> {
    if (!dossierId || !UUID_RE.test(dossierId)) return dossierId;
    const [row] = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            folderPath: dossiers.folderPath,
        })
        .from(dossiers)
        .where(activeDossierWhere(eq(dossiers.id, dossierId)))
        .limit(1);
    if (!row) return dossierId;
    return formatDossierLabel(row);
}
