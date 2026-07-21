import { and, eq, isNull, like } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    archiveAclEntries,
    archiveAclPrincipals,
} from "../../db/schemas/archive-acl.ts";
import { documentTypes } from "../../db/schemas/document-type.ts";
import { metadataTemplates } from "../../db/schemas/metadata_template.ts";
import type { MetadataFieldCatalogEntry } from "../../libs/metadata-template.ts";
import { parseFieldCatalog } from "../../libs/metadata-template.ts";
import {
    expandSlotFieldKeys,
} from "../../libs/metadata-permission.ts";
import type { ArchiveAclPrincipalInput } from "./archive-acl-service.ts";
import {
    buildAclGrantIndex,
    warnMetadataMissingDocumentTypeRead,
    type AclParentWarning,
} from "./archive-acl-parent-warnings.ts";
import {
    ARCHIVE_METADATA_VIEW_PREFIX,
    buildMetadataViewFieldKey,
    buildMetadataViewSlotKey,
    isArchiveMetadataViewPermissionKey,
    parseMetadataViewFieldKey,
    parseMetadataViewSlotKey,
} from "./archive-metadata-acl-keys.ts";
import { ArchiveAclService } from "./archive-acl-service.ts";

export type MetadataViewSlotInput = {
    slotCode: string;
    sortOrder: number;
    principals: ArchiveAclPrincipalInput[];
    fieldKeys: string[];
};

export type MetadataViewGroupT = {
    groupCode: string;
    groupName: string;
    fields: Array<{
        key: string;
        name: string;
        display: string;
    }>;
};

function fieldCatalogToGroups(
    catalog: MetadataFieldCatalogEntry[],
    documentTypeId: string,
): MetadataViewGroupT[] {
    const filtered = catalog.filter((e) => e.groupCode === documentTypeId);
    if (filtered.length === 0) return [];

    const groupName =
        filtered[0]?.groupName ||
        documentTypeId.replace(/_/g, " ");

    return [{
        groupCode: documentTypeId,
        groupName,
        fields: filtered.map((e) => ({
            key: e.key,
            name: e.fieldName,
            display: e.display,
        })),
    }];
}

async function getActiveFieldCatalog(): Promise<MetadataFieldCatalogEntry[]> {
    const row = await db.query.metadataTemplates.findFirst({
        where: and(
            eq(metadataTemplates.isActive, true),
            isNull(metadataTemplates.deletedAt),
        ),
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
        columns: { fieldCatalog: true },
    });
    if (!row) return [];
    return parseFieldCatalog(row.fieldCatalog);
}

async function loadWarehouseAclEntries() {
    return db.query.archiveAclEntries.findMany({
        where: (t, { not, like: likeFn }) =>
            not(likeFn(t.permissionKey, `${ARCHIVE_METADATA_VIEW_PREFIX}%`)),
        with: { principals: true },
    });
}

async function loadMetadataViewEntries(documentTypeId: string) {
    return db.query.archiveAclEntries.findMany({
        where: and(
            eq(archiveAclEntries.resourceKind, "document_type"),
            eq(archiveAclEntries.resourceId, documentTypeId),
            like(archiveAclEntries.permissionKey, `${ARCHIVE_METADATA_VIEW_PREFIX}%`),
        ),
        with: { principals: true },
    });
}

function parseSlotsFromEntries(
    entries: Awaited<ReturnType<typeof loadMetadataViewEntries>>,
): MetadataViewSlotInput[] {
    const slotMap = new Map<string, MetadataViewSlotInput>();

    for (const entry of entries) {
        const slotCode = parseMetadataViewSlotKey(entry.permissionKey);
        if (slotCode) {
            const existing = slotMap.get(slotCode) ?? {
                slotCode,
                sortOrder: slotMap.size,
                principals: [],
                fieldKeys: [],
            };
            existing.principals = entry.principals.map((p) => ({
                kind: p.principalKind,
                id: p.principalId,
            }));
            slotMap.set(slotCode, existing);
            continue;
        }

        const parsed = parseMetadataViewFieldKey(entry.permissionKey);
        if (!parsed) continue;
        const existing = slotMap.get(parsed.slotCode) ?? {
            slotCode: parsed.slotCode,
            sortOrder: slotMap.size,
            principals: [],
            fieldKeys: [],
        };
        if (!existing.fieldKeys.includes(parsed.fieldPattern)) {
            existing.fieldKeys.push(parsed.fieldPattern);
        }
        slotMap.set(parsed.slotCode, existing);
    }

    return [...slotMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

async function buildNameByPrincipalKey(): Promise<Map<string, string>> {
    const catalog = await ArchiveAclService.listPrincipalCatalog();
    const map = new Map<string, string>();
    for (const u of catalog.users) map.set(`user:${u.id}`, u.name);
    for (const r of catalog.roles) map.set(`role:${r.id}`, r.name);
    return map;
}

async function computeMetadataWarnings(
    documentTypeId: string,
    slots: MetadataViewSlotInput[],
): Promise<AclParentWarning[]> {
    const [warehouseEntries, nameByKey] = await Promise.all([
        loadWarehouseAclEntries(),
        buildNameByPrincipalKey(),
    ]);
    const index = buildAclGrantIndex(
        warehouseEntries.map((e) => ({
            resourceKind: e.resourceKind,
            resourceId: e.resourceId,
            permissionKey: e.permissionKey,
            principals: e.principals.map((p) => ({
                kind: p.principalKind,
                id: p.principalId,
            })),
        })),
    );

    const warnings: AclParentWarning[] = [];
    const seenCodes = new Set<string>();
    const allPrincipals = slots.flatMap((s) => s.principals);
    const w = warnMetadataMissingDocumentTypeRead(
        allPrincipals,
        documentTypeId,
        index,
        nameByKey,
    );
    if (w && !seenCodes.has(w.code)) {
        warnings.push(w);
        seenCodes.add(w.code);
    }
    return warnings;
}

async function assertDocumentTypeExists(documentTypeId: string) {
    const row = await db.query.documentTypes.findFirst({
        where: eq(documentTypes.id, documentTypeId),
        columns: { id: true, name: true },
    });
    if (!row) throw httpError.notFound("Không tìm thấy loại tài liệu");
    return row;
}

export const ArchiveMetadataAclService = {
    async listDocumentTypes() {
        const [types, catalog] = await Promise.all([
            db.query.documentTypes.findMany({
                where: eq(documentTypes.isActive, true),
                columns: { id: true, name: true },
                orderBy: (t, { asc }) => [asc(t.name)],
            }),
            getActiveFieldCatalog(),
        ]);

        const configuredIds = new Set<string>();
        const entries = await db.query.archiveAclEntries.findMany({
            where: like(
                archiveAclEntries.permissionKey,
                `${ARCHIVE_METADATA_VIEW_PREFIX}%`,
            ),
            columns: { resourceId: true },
        });
        for (const e of entries) configuredIds.add(e.resourceId);

        const catalogGroupCodes = new Set(catalog.map((c) => c.groupCode));

        return types
            .filter((t) => catalogGroupCodes.has(t.id))
            .map((t) => ({
                id: t.id,
                name: t.name,
                hasMetadataConfig: configuredIds.has(t.id),
            }));
    },

    async getDocumentTypeMatrix(documentTypeId: string) {
        const docType = await assertDocumentTypeExists(documentTypeId);
        const catalog = await getActiveFieldCatalog();
        const groups = fieldCatalogToGroups(catalog, documentTypeId);
        const entries = await loadMetadataViewEntries(documentTypeId);
        const slots = parseSlotsFromEntries(entries);
        const warnings = await computeMetadataWarnings(documentTypeId, slots);

        return {
            documentType: { id: docType.id, name: docType.name },
            groups,
            slots,
            hasMetadataConfig: entries.length > 0,
            warnings,
        };
    },

    async saveDocumentTypeMatrix(
        documentTypeId: string,
        slots: MetadataViewSlotInput[],
    ) {
        await assertDocumentTypeExists(documentTypeId);
        const catalog = await getActiveFieldCatalog();
        const catalogKeys = catalog
            .filter((e) => e.groupCode === documentTypeId)
            .map((e) => e.key);

        for (const slot of slots) {
            const expanded = expandSlotFieldKeys(
                { fieldKeys: slot.fieldKeys },
                catalogKeys,
            );
            for (const pattern of slot.fieldKeys) {
                if (pattern.endsWith(".*")) {
                    const prefix = pattern.slice(0, -2);
                    if (prefix !== documentTypeId) {
                        throw httpError.badRequest(`Mẫu trường không hợp lệ: ${pattern}`);
                    }
                } else if (!catalogKeys.includes(pattern)) {
                    throw httpError.badRequest(`Trường không hợp lệ: ${pattern}`);
                }
            }
            void expanded;
        }

        await db.transaction(async (tx) => {
            const existing = await tx.query.archiveAclEntries.findMany({
                where: and(
                    eq(archiveAclEntries.resourceKind, "document_type"),
                    eq(archiveAclEntries.resourceId, documentTypeId),
                    like(archiveAclEntries.permissionKey, `${ARCHIVE_METADATA_VIEW_PREFIX}%`),
                ),
                columns: { id: true },
            });
            if (existing.length > 0) {
                await tx.delete(archiveAclEntries).where(
                    and(
                        eq(archiveAclEntries.resourceKind, "document_type"),
                        eq(archiveAclEntries.resourceId, documentTypeId),
                        like(archiveAclEntries.permissionKey, `${ARCHIVE_METADATA_VIEW_PREFIX}%`),
                    ),
                );
            }

            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i]!;
                const slotKey = buildMetadataViewSlotKey(slot.slotCode);
                const [slotEntry] = await tx.insert(archiveAclEntries).values({
                    resourceKind: "document_type",
                    resourceId: documentTypeId,
                    permissionKey: slotKey,
                    updatedAt: new Date(),
                }).returning();

                if (slot.principals.length > 0) {
                    await tx.insert(archiveAclPrincipals).values(
                        slot.principals.map((p) => ({
                            entryId: slotEntry!.id,
                            principalKind: p.kind,
                            principalId: p.id,
                            updatedAt: new Date(),
                        })),
                    );
                }

                for (const pattern of slot.fieldKeys) {
                    await tx.insert(archiveAclEntries).values({
                        resourceKind: "document_type",
                        resourceId: documentTypeId,
                        permissionKey: buildMetadataViewFieldKey(slot.slotCode, pattern),
                        updatedAt: new Date(),
                    });
                }
            }
        });

        const result = await this.getDocumentTypeMatrix(documentTypeId);
        const warnings = await computeMetadataWarnings(documentTypeId, slots);
        return { ...result, warnings };
    },

    async assignAllToSlot(
        documentTypeId: string,
        slotCode: string,
        principals: ArchiveAclPrincipalInput[],
    ) {
        const current = await this.getDocumentTypeMatrix(documentTypeId);
        const catalog = await getActiveFieldCatalog();
        const catalogKeys = catalog
            .filter((e) => e.groupCode === documentTypeId)
            .map((e) => e.key);

        let slots = current.slots;
        const idx = slots.findIndex((s) => s.slotCode === slotCode);
        if (idx < 0) {
            slots = [
                ...slots,
                {
                    slotCode,
                    sortOrder: slots.length,
                    principals,
                    fieldKeys: [`${documentTypeId}.*`],
                },
            ];
        } else {
            slots = slots.map((s, i) =>
                i === idx
                    ? {
                        ...s,
                        principals,
                        fieldKeys: catalogKeys.length > 0
                            ? [`${documentTypeId}.*`]
                            : s.fieldKeys,
                    }
                    : s
            );
        }

        return this.saveDocumentTypeMatrix(documentTypeId, slots);
    },
};

export { isArchiveMetadataViewPermissionKey };
