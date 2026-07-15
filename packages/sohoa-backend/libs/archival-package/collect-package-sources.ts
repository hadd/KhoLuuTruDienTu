import { collectMetadataPdfSources } from "../metadata-export.ts";
import { downloadExportPdf } from "../../modules/data-entry/data-entry-s3-utils.ts";
import { normalizeStorageKey } from "../../modules/dossier/dossier-path-utils.ts";
import type { DossierMetadata } from "../metadata-types.ts";
import type { PackagePdfFile } from "./package-types.ts";

export async function collectPackagePdfFiles(
    metadata: DossierMetadata,
    dossierFiles: Array<{ fileName: string; filePath: string }> = [],
): Promise<PackagePdfFile[]> {
    const sources = collectMetadataPdfSources(metadata, dossierFiles);
    const groupByPath = new Map<string, string>();

    for (const group of metadata.metadata_groups) {
        const filePath = group.source_document?.file_path;
        if (filePath) {
            groupByPath.set(normalizeStorageKey(filePath), group.group_code);
        }
    }

    return await Promise.all(
        sources.map(async (source) => ({
            fileName: source.fileName,
            data: await downloadExportPdf(source.storageKey),
            groupCode: groupByPath.get(normalizeStorageKey(source.storageKey)),
        })),
    );
}
