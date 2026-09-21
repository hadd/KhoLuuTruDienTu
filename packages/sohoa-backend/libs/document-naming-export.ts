import { normalizeStorageKey } from "../modules/dossier/dossier-path-utils.ts";
import {
    buildDocumentName,
    DOCUMENT_NAMING_SYNTHETIC_METADATA_FIELDS,
    type DocumentNamingFieldOption,
    type DocumentNamingSegment,
} from "./document-naming-types.ts";
import {
    extractDossierFileItems,
    resolveExportColumnValueForFile,
    TT05_DEFAULT_EXPORT_COLUMNS,
    type DossierFileItem,
} from "./metadata-export-field-resolver.ts";
import type { DossierMetadata } from "./metadata-types.ts";

function sanitizeZipEntryName(name: string): string {
    return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim() || "document.pdf";
}

function uniqueZipEntryName(fileName: string, usedNames: Set<string>): string {
    const safeName = sanitizeZipEntryName(fileName);
    if (!usedNames.has(safeName)) {
        usedNames.add(safeName);
        return safeName;
    }

    const dotIndex = safeName.lastIndexOf(".");
    const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
    const ext = dotIndex > 0 ? safeName.slice(dotIndex) : "";

    let counter = 2;
    while (usedNames.has(`${base} (${counter})${ext}`)) {
        counter++;
    }

    const uniqueName = `${base} (${counter})${ext}`;
    usedNames.add(uniqueName);
    return uniqueName;
}

function ensureFileExtension(baseName: string, originalFileName: string): string {
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

function findFileItemForStorageKey(
    fileItems: DossierFileItem[],
    storageKey: string,
    fallbackIndex: number,
): DossierFileItem {
    const matched = fileItems.find((item) => {
        const path = item.sourceDocument.file_path;
        return path != null && normalizeStorageKey(path) === storageKey;
    });
    if (matched) return matched;

    const byIndex = fileItems.find((item) => item.fileIndex === fallbackIndex + 1);
    if (byIndex) return byIndex;

    return fileItems[fallbackIndex] ?? fileItems[0] ?? {
        fileIndex: fallbackIndex + 1,
        sourceDocument: { file_name: null, file_path: null },
        groups: [],
    };
}

function resolveMetadataFieldValues(
    metadata: DossierMetadata,
    fileItem: DossierFileItem,
    fieldKeys: string[],
    options: { dossierIndex: number; fileIndex: number; fileCount: number },
): Record<string, string> {
    const values: Record<string, string> = {};
    for (const fieldKey of fieldKeys) {
        values[fieldKey] = resolveExportColumnValueForFile(
            metadata,
            fileItem,
            { header: fieldKey, fieldKeys: [fieldKey], separator: "" },
            options,
        );
    }
    return values;
}

export function buildStaticMetadataNamingFieldOptions(): DocumentNamingFieldOption[] {
    const seen = new Set<string>();
    const options: DocumentNamingFieldOption[] = [];

    for (const item of DOCUMENT_NAMING_SYNTHETIC_METADATA_FIELDS) {
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        options.push(item);
    }

    for (const column of TT05_DEFAULT_EXPORT_COLUMNS) {
        for (const key of column.fieldKeys) {
            if (!key || seen.has(key)) continue;
            seen.add(key);
            options.push({ key, label: `${column.header} (${key})` });
        }
    }

    return options;
}

export function mergeMetadataNamingFieldOptions(
    liveCatalog: Array<{ key: string; display: string; groupName?: string }>,
): DocumentNamingFieldOption[] {
    if (liveCatalog && liveCatalog.length > 0) {
        const seen = new Set<string>();
        const options: DocumentNamingFieldOption[] = [];
        for (const item of liveCatalog) {
            if (!item.key || seen.has(item.key)) continue;
            seen.add(item.key);
            const label = item.groupName
                ? `${item.display} (${item.groupName})`
                : item.display || item.key;
            options.push({ key: item.key, label });
        }
        return options;
    }

    return buildStaticMetadataNamingFieldOptions();
}

export type DocumentNamingExportContext = {
    segments: DocumentNamingSegment[];
    fond?: Record<string, string | null | undefined>;
    dossier?: Record<string, string | null | undefined>;
    /** Starting auto-increment value; mutated per resolved file within the session. */
    autoIncrementCounter: number;
};

export function resolveNamedPdfFileName(input: {
    context: DocumentNamingExportContext;
    metadata: DossierMetadata;
    originalFileName: string;
    storageKey: string;
    sourceIndex: number;
    dossierFiles?: Array<{ fileName: string; filePath: string; documentTypeId?: string | null }>;
    dossierIndex?: number;
    usedNames: Set<string>;
}): string {
    const fileItems = extractDossierFileItems(input.metadata);
    const fileItem = findFileItemForStorageKey(
        fileItems,
        input.storageKey,
        input.sourceIndex,
    );
    const dossierFile = input.dossierFiles?.find(
        (file) => normalizeStorageKey(file.filePath) === input.storageKey,
    );

    const metadataKeys = input.context.segments
        .filter((segment) => segment.source === "metadata_field" && segment.fieldKey)
        .map((segment) => segment.fieldKey!);

    const metadataValues = resolveMetadataFieldValues(
        input.metadata,
        fileItem,
        metadataKeys,
        {
            dossierIndex: input.dossierIndex ?? 0,
            fileIndex: fileItem.fileIndex,
            fileCount: fileItems.length,
        },
    );

    const baseName = buildDocumentName({
        segments: input.context.segments,
        fond: input.context.fond,
        dossier: input.context.dossier,
        file: {
            fileName: dossierFile?.fileName ?? input.originalFileName,
            documentTypeId: dossierFile?.documentTypeId ?? "",
        },
        metadataValues,
        autoIncrementCounter: input.context.autoIncrementCounter,
    });

    if (input.context.segments.some((segment) => segment.source === "auto_increment")) {
        input.context.autoIncrementCounter += 1;
    }

    const withExt = ensureFileExtension(baseName, input.originalFileName);
    return uniqueZipEntryName(withExt, input.usedNames);
}
