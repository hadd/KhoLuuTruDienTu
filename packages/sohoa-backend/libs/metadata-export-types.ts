export interface MetadataExportColumnConfig {
    header: string;
    fieldKeys: string[];
    separator: string;
}

export const METADATA_EXPORT_STT_HEADER = "STT";

export function isExportSttColumn(column: MetadataExportColumnConfig): boolean {
    return column.header.trim() === METADATA_EXPORT_STT_HEADER && column.fieldKeys.length === 0;
}

export function createExportSttColumn(): MetadataExportColumnConfig {
    return {
        header: METADATA_EXPORT_STT_HEADER,
        fieldKeys: [],
        separator: "",
    };
}

export interface MetadataExportConfig {
    columns: MetadataExportColumnConfig[];
}

export interface MetadataExportFieldCatalogItem {
    key: string;
    groupCode: string;
    groupName: string;
    fieldName: string;
    display: string;
}

export function parseExportColumns(json: string): MetadataExportColumnConfig[] {
    const parsed = JSON.parse(json) as MetadataExportColumnConfig[];
    if (!Array.isArray(parsed)) {
        throw new Error("Invalid export columns JSON");
    }
    return parsed;
}

export function serializeExportColumns(columns: MetadataExportColumnConfig[]): string {
    return JSON.stringify(columns);
}

export function validateExportColumns(columns: MetadataExportColumnConfig[]): void {
    if (columns.length === 0) {
        throw new Error("Export columns must not be empty");
    }

    const headers = new Set<string>();
    for (const column of columns) {
        const header = column.header.trim();
        if (!header) {
            throw new Error("Column header must not be empty");
        }
        if (headers.has(header)) {
            throw new Error(`Duplicate column header: ${header}`);
        }
        headers.add(header);

        if (!Array.isArray(column.fieldKeys)) {
            throw new Error(`Column "${header}" has invalid field keys`);
        }
    }
}

export function validateExportColumnsForExport(columns: MetadataExportColumnConfig[]): void {
    validateExportColumns(columns);
    for (const column of columns) {
        if (column.fieldKeys.length === 0 && !isExportSttColumn(column)) {
            throw new Error(`Column "${column.header}" must include at least one field`);
        }
    }
}
