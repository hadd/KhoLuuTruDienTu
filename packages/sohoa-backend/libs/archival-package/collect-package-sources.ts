import { collectMetadataPdfSources } from "../metadata-export.ts";
import { expandTaiLieuDocuments } from "../metadata-normalize.ts";
import { downloadExportPdf } from "../../modules/data-entry/data-entry-s3-utils.ts";
import { normalizeStorageKey } from "../../modules/dossier/dossier-path-utils.ts";
import type { DossierMetadata } from "../metadata-types.ts";
import type { PackagePdfFile } from "./package-types.ts";
import {
    EXPORT_DOWNLOAD_CONCURRENCY,
    mapWithConcurrency,
} from "../export-concurrency.ts";
import {
    resolveNamedPdfFileName,
    type DocumentNamingExportContext,
} from "../document-naming-export.ts";

export function countPackagePdfSources(
    metadata: DossierMetadata,
    dossierFiles: Array<{ fileName: string; filePath: string }> = [],
): number {
    return collectMetadataPdfSources(metadata, dossierFiles).length;
}

export async function collectPackagePdfFiles(
    metadata: DossierMetadata,
    dossierFiles: Array<{
        fileName: string;
        filePath: string;
        documentTypeId?: string | null;
    }> = [],
    options?: {
        namingContext?: DocumentNamingExportContext | null;
        dossierIndex?: number;
    },
): Promise<PackagePdfFile[]> {
    const sources = collectMetadataPdfSources(metadata, dossierFiles);
    const groupByPath = new Map<string, string>();
    const expanded = expandTaiLieuDocuments(metadata);

    for (const group of expanded.metadata_groups) {
        const filePath = group.source_document?.file_path;
        if (filePath) {
            groupByPath.set(normalizeStorageKey(filePath), group.group_code);
        }
    }

    const usedNames = new Set<string>();
    const resolvedNames = sources.map((source, sourceIndex) => {
        if (!options?.namingContext) return source.fileName;
        return resolveNamedPdfFileName({
            context: options.namingContext,
            metadata,
            originalFileName: source.fileName,
            storageKey: source.storageKey,
            sourceIndex,
            dossierFiles,
            dossierIndex: options.dossierIndex ?? 0,
            usedNames,
        });
    });

    return await mapWithConcurrency(
        sources,
        EXPORT_DOWNLOAD_CONCURRENCY,
        async (source, index) => ({
            fileName: resolvedNames[index] ?? source.fileName,
            data: await downloadExportPdf(source.storageKey),
            groupCode: groupByPath.get(normalizeStorageKey(source.storageKey)),
        }),
    );
}
