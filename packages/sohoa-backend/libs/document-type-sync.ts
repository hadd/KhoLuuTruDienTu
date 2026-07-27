import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { documentTypes } from "../db/schemas/document-type.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import {
    ARCHIVAL_GROUP_CODES,
    expandTaiLieuDocuments,
    extractDocumentTypeRefsFromMetadata,
    findMetadataFieldValue,
    parseDossierMetadata,
    slugifyTenLoaiTaiLieu,
    TEN_LOAI_TAI_LIEU_FIELD,
    TAI_LIEU_LUU_TRU_GROUP_CODE,
    type DocumentTypeRef,
} from "./metadata-normalize.ts";
import type {
    DossierMetadata,
    MetadataDocumentItem,
    MetadataGroup,
} from "./metadata-types.ts";
import { isDossierMetadata } from "./metadata-types.ts";

export {
    extractDocumentTypeRefsFromMetadata,
    type DocumentTypeRef,
} from "./metadata-normalize.ts";

function normalizeStorageKey(key: string): string {
    return key.replace(/^\/+/, "").replace(/\\/g, "/");
}

/** Chuẩn hoá mã loại tài liệu (= OCR group_code hoặc slug TEN_LOAI_TAI_LIEU). */
export function normalizeDocumentTypeId(raw: string | null | undefined): string | null {
    const id = raw?.trim();
    return id ? id : null;
}

function getNestedDocuments(
    group: MetadataGroup,
): MetadataDocumentItem[] | null {
    const raw = group.documents ?? group.document;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw;
}

/**
 * Upsert document_types từ OCR metadata:
 * - TT05: TEN_LOAI_TAI_LIEU trong documents[]
 * - Legacy: group_code + group_name
 */
export async function upsertDocumentTypesFromMetadata(
    metadata: DossierMetadata,
): Promise<DocumentTypeRef[]> {
    const refs = extractDocumentTypeRefsFromMetadata(metadata);
    if (refs.length === 0) return [];

    const now = new Date();
    await db
        .insert(documentTypes)
        .values(
            refs.map((ref) => ({
                id: ref.id,
                name: ref.name,
                description: "",
                isActive: true,
                createdAt: now,
                updatedAt: now,
            })),
        )
        .onConflictDoUpdate({
            target: documentTypes.id,
            set: {
                name: sql`excluded.name`,
                updatedAt: now,
            },
        });

    return refs;
}

function pathBasenamesMatch(a: string, b: string): boolean {
    const na = normalizeStorageKey(a).toLowerCase();
    const nb = normalizeStorageKey(b).toLowerCase();
    if (na === nb) return true;
    const baseA = na.split("/").pop() ?? na;
    const baseB = nb.split("/").pop() ?? nb;
    return Boolean(baseA) && baseA === baseB;
}

function fileMatchesSourceDocument(
    file: { fileName: string; filePath: string },
    sourceDocument: MetadataDocumentItem["source_document"],
): boolean {
    const srcPath = sourceDocument?.file_path?.trim() || "";
    const srcName = sourceDocument?.file_name?.trim() || "";
    const byPath = srcPath && pathBasenamesMatch(file.filePath, srcPath);
    const byName = srcName &&
        file.fileName.toLowerCase() === srcName.toLowerCase();
    return Boolean(byPath || byName);
}

function resolveDocumentTypeIdForItem(
    item: MetadataDocumentItem,
): string | null {
    const displayName = findMetadataFieldValue(
        item.fields,
        TEN_LOAI_TAI_LIEU_FIELD,
    );
    if (!displayName) return null;
    return normalizeDocumentTypeId(slugifyTenLoaiTaiLieu(displayName));
}

function assignTypeForSourceDocument(
    files: Array<{ id: string; fileName: string; filePath: string }>,
    primaryTypeByFileId: Map<string, string>,
    sourceDocument: MetadataDocumentItem["source_document"],
    typeId: string | null,
) {
    if (!typeId) return;
    for (const file of files) {
        if (primaryTypeByFileId.has(file.id)) continue;
        if (fileMatchesSourceDocument(file, sourceDocument)) {
            primaryTypeByFileId.set(file.id, typeId);
        }
    }
}

/**
 * Gán files.document_type_id theo metadata.
 * TT05: TEN_LOAI_TAI_LIEU trong documents[]; legacy: group_code.
 */
export async function syncFileDocumentTypesFromMetadata(
    dossierId: string,
    metadata: DossierMetadata,
): Promise<{ updated: number }> {
    const files = await db
        .select({
            id: dossierFiles.id,
            fileName: dossierFiles.fileName,
            filePath: dossierFiles.filePath,
            documentTypeId: dossierFiles.documentTypeId,
        })
        .from(dossierFiles)
        .where(eq(dossierFiles.dossierId, dossierId));

    if (files.length === 0) return { updated: 0 };

    const primaryTypeByFileId = new Map<string, string>();

    for (const group of metadata.metadata_groups) {
        const nestedDocuments = getNestedDocuments(group);
        if (
            group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE &&
            nestedDocuments
        ) {
            for (const item of nestedDocuments) {
                assignTypeForSourceDocument(
                    files,
                    primaryTypeByFileId,
                    item.source_document,
                    resolveDocumentTypeIdForItem(item),
                );
            }
            continue;
        }

        if (ARCHIVAL_GROUP_CODES.has(group.group_code)) {
            if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
                const displayName = findMetadataFieldValue(
                    group.fields,
                    TEN_LOAI_TAI_LIEU_FIELD,
                );
                const typeId = displayName
                    ? normalizeDocumentTypeId(slugifyTenLoaiTaiLieu(displayName))
                    : null;
                assignTypeForSourceDocument(
                    files,
                    primaryTypeByFileId,
                    group.source_document,
                    typeId,
                );
            }
            continue;
        }

        const typeId = normalizeDocumentTypeId(group.group_code);
        if (!typeId) continue;
        assignTypeForSourceDocument(
            files,
            primaryTypeByFileId,
            group.source_document,
            typeId,
        );
    }

    let updated = 0;
    for (const [fileId, typeId] of primaryTypeByFileId) {
        const current = files.find((f) => f.id === fileId);
        if (current?.documentTypeId === typeId) continue;
        await db
            .update(dossierFiles)
            .set({ documentTypeId: typeId })
            .where(and(
                eq(dossierFiles.id, fileId),
                eq(dossierFiles.dossierId, dossierId),
            ));
        updated += 1;
    }

    return { updated };
}

/** Upsert catalog + gán FK file từ OCR metadata. */
export async function syncDocumentTypesFromOcrMetadata(
    dossierId: string,
    metadata: unknown,
): Promise<{ types: DocumentTypeRef[]; filesUpdated: number } | null> {
    const parsed = parseDossierMetadata(metadata);
    if (!parsed && !isDossierMetadata(metadata)) return null;
    const normalized = parsed ?? expandTaiLieuDocuments(metadata as DossierMetadata);
    const types = await upsertDocumentTypesFromMetadata(normalized);
    const { updated } = await syncFileDocumentTypesFromMetadata(
        dossierId,
        normalized,
    );
    return { types, filesUpdated: updated };
}

/** Overlay group_name từ catalog document_types (ưu tiên SSOT). */
export async function enrichMetadataGroupNamesFromCatalog(
    metadata: DossierMetadata,
): Promise<DossierMetadata> {
    const codes = [
        ...new Set(
            extractDocumentTypeRefsFromMetadata(metadata).map((ref) => ref.id),
        ),
    ];
    if (codes.length === 0) return metadata;

    const rows = await db
        .select({ id: documentTypes.id, name: documentTypes.name })
        .from(documentTypes)
        .where(inArray(documentTypes.id, codes));
    const nameById = new Map(rows.map((r) => [r.id, r.name]));

    const groups: MetadataGroup[] = metadata.metadata_groups.map((group) => {
        const nestedDocuments = getNestedDocuments(group);
        if (nestedDocuments) {
            return {
                ...group,
                documents: nestedDocuments.map((item) => ({
                    ...item,
                    fields: item.fields.map((field) => {
                        if (field.name !== TEN_LOAI_TAI_LIEU_FIELD) return field;
                        const value = field.value?.trim();
                        if (!value) return field;
                        const catalogName = nameById.get(
                            slugifyTenLoaiTaiLieu(value),
                        );
                        if (!catalogName || catalogName === value) return field;
                        return { ...field, value: catalogName };
                    }),
                })),
            };
        }

        const id = normalizeDocumentTypeId(group.group_code);
        if (!id) return group;
        const catalogName = nameById.get(id);
        if (!catalogName || catalogName === group.group_name) return group;
        return { ...group, group_name: catalogName };
    });

    return { ...metadata, metadata_groups: groups };
}

export {
    slugifyTenLoaiTaiLieu,
    TEN_LOAI_TAI_LIEU_FIELD,
};
