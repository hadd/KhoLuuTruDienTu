import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { documentNamingConfigs } from "../../db/schemas/document-naming-config.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { fonds } from "../../db/schemas/fond.ts";
import {
    buildDocumentName,
    type DocumentNamingSegment,
} from "../../libs/document-naming-types.ts";
import {
    extractDossierFileItems,
    resolveExportColumnValueForFile,
} from "../../libs/metadata-export-field-resolver.ts";
import { isDossierMetadata, type DossierMetadata } from "../../libs/metadata-types.ts";
import {
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
    uploadJsonToStorage,
} from "../data-entry/data-entry-s3-utils.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim() || "document.pdf";
}

function uniqueFileName(fileName: string, usedNames: Set<string>): string {
    const safeName = sanitizeFileName(fileName);
    if (!usedNames.has(safeName)) {
        usedNames.add(safeName);
        return safeName;
    }

    const dotIndex = safeName.lastIndexOf(".");
    const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
    const ext = dotIndex > 0 ? safeName.slice(dotIndex) : ".pdf";

    let counter = 1;
    while (usedNames.has(`${base} (${counter})${ext}`)) {
        counter++;
    }

    const uniqueName = `${base} (${counter})${ext}`;
    usedNames.add(uniqueName);
    return uniqueName;
}

function ensurePdfExtension(baseName: string, originalFileName: string): string {
    const trimmed = baseName.trim();
    const originalDot = originalFileName.lastIndexOf(".");
    const originalExt = originalDot > 0
        ? originalFileName.slice(originalDot)
        : ".pdf";

    if (!trimmed) {
        return `document${originalExt}`;
    }

    const lower = trimmed.toLowerCase();
    const extLower = originalExt.toLowerCase();
    if (lower.endsWith(extLower)) {
        return trimmed;
    }
    return `${trimmed}${originalExt}`;
}

export const DocumentNamingApplyService = {
    async applyNamingOnDossierApproved(
        tx: DbTx | typeof db,
        dossierId: string,
        finalMetadata?: unknown,
    ): Promise<void> {
        try {
            const config = await (tx ?? db).query.documentNamingConfigs.findFirst({
                where: and(
                    eq(documentNamingConfigs.targetType, "file"),
                    eq(documentNamingConfigs.dossierId, dossierId),
                    isNull(documentNamingConfigs.deletedAt),
                ),
            });

            if (!config || !config.applyOnApprove || !Array.isArray(config.segments) || config.segments.length === 0) {
                return;
            }

            const dossier = await (tx ?? db).query.dossiers.findFirst({
                where: and(eq(dossiers.id, dossierId), isNull(dossiers.deletedAt)),
            });
            if (!dossier) return;

            const fond = dossier.fondId
                ? await (tx ?? db).query.fonds.findFirst({
                    where: and(eq(fonds.id, dossier.fondId), isNull(fonds.deletedAt)),
                })
                : null;

            const files = await (tx ?? db).query.dossierFiles.findMany({
                where: eq(dossierFiles.dossierId, dossierId),
                orderBy: [asc(dossierFiles.createdAt), asc(dossierFiles.fileName)],
            });
            if (files.length === 0) return;

            let metadata: DossierMetadata | null = null;
            if (isDossierMetadata(finalMetadata)) {
                metadata = finalMetadata;
            } else {
                const metaKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
                if (metaKey) {
                    try {
                        const raw = await downloadJsonFromStorage(resolveMetadataJsonKey(metaKey));
                        if (isDossierMetadata(raw)) {
                            metadata = raw;
                        }
                    } catch (err) {
                        console.error("[DocumentNamingApply] Failed to download metadata:", err);
                    }
                }
            }

            const fileItems = metadata
                ? extractDossierFileItems(
                    metadata,
                    files.map((f) => ({ fileName: f.fileName, filePath: f.filePath })),
                )
                : [];

            const metadataKeys = config.segments
                .filter((segment: DocumentNamingSegment) => segment.source === "metadata_field" && segment.fieldKey)
                .map((segment: DocumentNamingSegment) => segment.fieldKey!);

            const usedNames = new Set<string>();
            let autoIncrementCounter = config.autoIncrementCounter ?? 1;
            const hasAutoIncrement = config.segments.some((s: DocumentNamingSegment) => s.source === "auto_increment");
            const updatedFileNames: Array<{ id: string; oldName: string; newName: string; filePath: string }> = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const storageKey = normalizeStorageKey(file.filePath);
                const fileItem = fileItems.find((item) => {
                    const path = item.sourceDocument.file_path;
                    return path != null && normalizeStorageKey(path) === storageKey;
                }) ?? fileItems[i] ?? {
                    fileIndex: i + 1,
                    sourceDocument: { file_name: file.fileName, file_path: file.filePath },
                    groups: [],
                };

                const metadataValues: Record<string, string> = {};
                if (metadata) {
                    for (const fieldKey of metadataKeys) {
                        metadataValues[fieldKey] = resolveExportColumnValueForFile(
                            metadata,
                            fileItem,
                            { header: fieldKey, fieldKeys: [fieldKey], separator: "" },
                            {
                                dossierIndex: 0,
                                fileIndex: fileItem.fileIndex,
                                fileCount: files.length,
                            },
                        );
                    }
                }

                const baseName = buildDocumentName({
                    segments: config.segments,
                    fond: fond
                        ? {
                            id: fond.id,
                            fondName: fond.fondName,
                            archiveAgency: fond.archiveAgency,
                            fondType: fond.fondType,
                        }
                        : undefined,
                    dossier: {
                        name: dossier.name,
                        folderPath: dossier.folderPath,
                        projectCode: dossier.projectCode,
                        dossierTypeId: dossier.dossierTypeId,
                    },
                    file: {
                        fileName: file.fileName,
                        documentTypeId: file.documentTypeId ?? "",
                    },
                    metadataValues,
                    autoIncrementCounter,
                });

                if (hasAutoIncrement) {
                    autoIncrementCounter += 1;
                }

                const withExt = ensurePdfExtension(baseName, file.fileName);
                const uniqueName = uniqueFileName(withExt, usedNames);

                updatedFileNames.push({
                    id: file.id,
                    oldName: file.fileName,
                    newName: uniqueName,
                    filePath: file.filePath,
                });
            }

            for (const item of updatedFileNames) {
                if (item.oldName !== item.newName) {
                    await (tx ?? db)
                        .update(dossierFiles)
                        .set({ fileName: item.newName })
                        .where(eq(dossierFiles.id, item.id));
                }
            }

            if (hasAutoIncrement && autoIncrementCounter !== config.autoIncrementCounter) {
                await (tx ?? db)
                    .update(documentNamingConfigs)
                    .set({ autoIncrementCounter, updatedAt: new Date() })
                    .where(eq(documentNamingConfigs.id, config.id));
            }

            if (metadata && (dossier.currentMetadataKey || dossier.ocrMetadataKey)) {
                let metadataChanged = false;
                const pathNameToNewName = new Map<string, string>();
                for (const item of updatedFileNames) {
                    pathNameToNewName.set(normalizeStorageKey(item.filePath), item.newName);
                    if (item.oldName) {
                        pathNameToNewName.set(item.oldName.toLowerCase(), item.newName);
                    }
                }

                for (const group of metadata.metadata_groups) {
                    if (group.source_document) {
                        const pathKey = group.source_document.file_path
                            ? normalizeStorageKey(group.source_document.file_path)
                            : null;
                        const nameKey = group.source_document.file_name
                            ? group.source_document.file_name.toLowerCase()
                            : null;
                        const newName = (pathKey && pathNameToNewName.get(pathKey)) ||
                            (nameKey && pathNameToNewName.get(nameKey));
                        if (newName && group.source_document.file_name !== newName) {
                            group.source_document.file_name = newName;
                            metadataChanged = true;
                        }
                    }
                    const nested = group.documents ?? group.document;
                    if (Array.isArray(nested)) {
                        for (const doc of nested) {
                            if (doc.source_document) {
                                const pathKey = doc.source_document.file_path
                                    ? normalizeStorageKey(doc.source_document.file_path)
                                    : null;
                                const nameKey = doc.source_document.file_name
                                    ? doc.source_document.file_name.toLowerCase()
                                    : null;
                                const newName = (pathKey && pathNameToNewName.get(pathKey)) ||
                                    (nameKey && pathNameToNewName.get(nameKey));
                                if (newName && doc.source_document.file_name !== newName) {
                                    doc.source_document.file_name = newName;
                                    metadataChanged = true;
                                }
                            }
                        }
                    }
                }

                if (metadataChanged) {
                    const targetKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
                    if (targetKey) {
                        try {
                            await uploadJsonToStorage(targetKey, metadata);
                        } catch (err) {
                            console.error("[DocumentNamingApply] Failed to update metadata.json on S3:", err);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("[DocumentNamingApply] Error applying document naming on approve:", error);
        }
    },
};
