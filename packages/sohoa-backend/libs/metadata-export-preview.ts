import {
    buildDefaultExportConfig,
    resolveExportColumnValue,
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
    options: { limit?: number } = {},
): MetadataExportPreviewResult {
    const limit = options.limit ?? METADATA_EXPORT_PREVIEW_ROW_LIMIT;
    const columns = exportConfig?.columns ?? buildDefaultExportConfig(metadataList);
    const headers = columns.map((column) => column.header);
    const previewList = metadataList.slice(0, limit);

    const rows = previewList.map((metadata, index) => ({
        rowLabel: resolveRowLabel(metadata, index),
        cells: columns.map((column) =>
            resolveExportColumnValue(metadata, column, { rowNumber: index + 1 })
        ),
    }));

    return {
        headers,
        rows,
        totalCount: metadataList.length,
        previewCount: previewList.length,
    };
}
