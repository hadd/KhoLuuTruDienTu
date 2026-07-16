import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { documentTypes } from "../db/schemas/document-type.ts";
import { dossierFiles } from "../db/schemas/dossier-file.ts";
import type { DossierMetadata, MetadataGroup } from "./metadata-types.ts";
import { isDossierMetadata } from "./metadata-types.ts";

function normalizeStorageKey(key: string): string {
    return key.replace(/^\/+/, "").replace(/\\/g, "/");
}

export type DocumentTypeRef = {
    id: string;
    name: string;
};

/** Chuẩn hoá mã loại tài liệu (= OCR group_code). */
export function normalizeDocumentTypeId(raw: string | null | undefined): string | null {
    const id = raw?.trim();
    return id ? id : null;
}

export function extractDocumentTypeRefsFromMetadata(
    metadata: DossierMetadata,
): DocumentTypeRef[] {
    const byId = new Map<string, string>();
    for (const group of metadata.metadata_groups) {
        const id = normalizeDocumentTypeId(group.group_code);
        if (!id) continue;
        const name = group.group_name?.trim() || id;
        if (!byId.has(id)) byId.set(id, name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
}

/**
 * Upsert document_types từ OCR metadata_groups:
 * id = group_code, name = group_name.
 * Không gán retention_period_id (admin cấu hình sau).
 * Chỉ gọi sau QC duyệt — không gọi từ OCR callback / draft.
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

/**
 * Gán files.document_type_id theo group_code của OCR group
 * khớp source_document với file_path / file_name.
 * Nhiều group / 1 file → lấy group đầu tiên trong metadata (thứ tự OCR).
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
        const typeId = normalizeDocumentTypeId(group.group_code);
        if (!typeId) continue;
        const srcPath = group.source_document?.file_path?.trim() || "";
        const srcName = group.source_document?.file_name?.trim() || "";

        for (const file of files) {
            if (primaryTypeByFileId.has(file.id)) continue;
            const byPath = srcPath && pathBasenamesMatch(file.filePath, srcPath);
            const byName = srcName &&
                file.fileName.toLowerCase() === srcName.toLowerCase();
            if (byPath || byName) {
                primaryTypeByFileId.set(file.id, typeId);
            }
        }
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
    if (!isDossierMetadata(metadata)) return null;
    const types = await upsertDocumentTypesFromMetadata(metadata);
    const { updated } = await syncFileDocumentTypesFromMetadata(dossierId, metadata);
    return { types, filesUpdated: updated };
}

/** Overlay group_name từ catalog document_types (ưu tiên SSOT). */
export async function enrichMetadataGroupNamesFromCatalog(
    metadata: DossierMetadata,
): Promise<DossierMetadata> {
    const codes = [
        ...new Set(
            metadata.metadata_groups
                .map((g) => normalizeDocumentTypeId(g.group_code))
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    if (codes.length === 0) return metadata;

    const rows = await db
        .select({ id: documentTypes.id, name: documentTypes.name })
        .from(documentTypes)
        .where(inArray(documentTypes.id, codes));
    const nameById = new Map(rows.map((r) => [r.id, r.name]));

    const groups: MetadataGroup[] = metadata.metadata_groups.map((group) => {
        const id = normalizeDocumentTypeId(group.group_code);
        if (!id) return group;
        const catalogName = nameById.get(id);
        if (!catalogName || catalogName === group.group_name) return group;
        return { ...group, group_name: catalogName };
    });

    return { ...metadata, metadata_groups: groups };
}
