import {
    buildDefaultExportConfig,
    extractDossierFileItems,
    resolveExportColumnValueForFile,
    type ExportDossierFileInput,
} from "./metadata-export-field-resolver.ts";
import type { MetadataExportConfig } from "./metadata-export-types.ts";
import type { DossierMetadata } from "./metadata-types.ts";

export const METADATA_EXPORT_PREVIEW_ROW_LIMIT = 10;

export interface MetadataExportPreviewRow {
    rowLabel: string;
    cells: string[];
}

export interface MetadataExportPreviewResult {
    headers: string[];
    rows: MetadataExportPreviewRow[];
    totalCount: number;
    previewCount: number;
}

function resolveRowLabel(metadata: DossierMetadata, index: number): string {
    const hoSoId = metadata.ho_so_id?.trim();
    if (hoSoId) {
        return hoSoId;
    }
    return `Hồ sơ ${index + 1}`;
}

export function buildMetadataExportPreview(
    metadataList: DossierMetadata[],
    exportConfig?: MetadataExportConfig,
    options: {
        limit?: number;
        dossierFilesList?: Array<ExportDossierFileInput[] | undefined>;
        dossierFolderPaths?: Array<string | null | undefined>;
    } = {},
): MetadataExportPreviewResult {
    const limit = options.limit ?? METADATA_EXPORT_PREVIEW_ROW_LIMIT;
    const columns = exportConfig?.columns ?? buildDefaultExportConfig(metadataList);
    const headers = columns.map((column) => column.header);

    const allRows: MetadataExportPreviewRow[] = [];
    let documentRowNumber = 0;

    metadataList.forEach((metadata, dossierIndex) => {
        const dossierFiles = options.dossierFilesList?.[dossierIndex] ?? [];
        const dossierFolderPath = options.dossierFolderPaths?.[dossierIndex] ?? null;
        const fileItems = extractDossierFileItems(metadata, dossierFiles);
        const closingDocsCount = fileItems.filter((f) => f.kind === "chung_tu_ket_thuc").length;
        const validDocCount = fileItems.filter((f) => f.kind === "document").length;
        const dossierRowCount = Math.max(1, fileItems.length);
        const dossierLabel = resolveRowLabel(metadata, dossierIndex);

        let dossierDocIndex = 0;
        for (let k = 0; k < dossierRowCount; k++) {
            const fileItem = fileItems[k]!;
            const kind = fileItem.kind ?? "document";
            const isExcludedFromStt = kind === "bia" || kind === "mucluc" || kind === "chung_tu_ket_thuc";
            const rowNumber = isExcludedFromStt
                ? undefined
                : ++documentRowNumber;
            const docIndexInDossier = isExcludedFromStt
                ? undefined
                : ++dossierDocIndex;
            const fileName =
                fileItem.sourceDocument.file_name?.trim() ||
                fileItem.sourceDocument.file_path?.trim() ||
                "";
            allRows.push({
                rowLabel: fileName
                    ? `${dossierLabel} / ${fileName}`
                    : dossierLabel,
                cells: columns.map((column) =>
                    resolveExportColumnValueForFile(metadata, fileItem, column, {
                        dossierIndex,
                        fileIndex: docIndexInDossier ?? k + 1,
                        fileCount: validDocCount,
                        validDocCount,
                        closingDocsCount,
                        rowNumber,
                        dossierFolderPath,
                    })
                ),
            });
        }
    });

    const previewRows = allRows.slice(0, limit);

    return {
        headers,
        rows: previewRows,
        totalCount: allRows.length,
        previewCount: previewRows.length,
    };
}
