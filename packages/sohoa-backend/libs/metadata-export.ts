import type { DossierMetadata } from "./metadata-types.ts";
import { expandTaiLieuDocuments } from "./metadata-normalize.ts";
import { normalizeStorageKey, storageBasename } from "../modules/dossier/dossier-path-utils.ts";
import { uniqueZipFolderPath } from "./archival-package/aip-path-utils.ts";
import { sanitizeFolderPathForZip } from "./archival-package/zip-utils.ts";
import { readableStreamToUint8Array } from "./jszip-stream.ts";
import { streamZipWhileBuilding } from "./streaming-zip-writer.ts";

export interface MetadataPdfSource {
    storageKey: string;
    fileName: string;
    /** When set, download this key instead of storageKey (signed PDF bytes). */
    downloadKey?: string;
    /** Skip watermark / PDF/A so embedded digital signatures stay valid. */
    preserveSignature?: boolean;
}

export interface MetadataExportPdfFile {
    fileName: string;
    data: Uint8Array;
    preserveSignature?: boolean;
}

function isPdfPath(path: string): boolean {
    return path.toLowerCase().endsWith(".pdf");
}

function sanitizeZipEntryName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "document.pdf";
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

type DossierFilePdfSourceInput = {
    fileName: string;
    filePath: string;
    signedFilePath?: string | null;
};

export function collectMetadataPdfSources(
    metadata: DossierMetadata,
    dossierFiles: DossierFilePdfSourceInput[] = [],
): MetadataPdfSource[] {
    const sources = new Map<string, MetadataPdfSource>();
    const signedByPath = new Map<string, string>();
    const expanded = expandTaiLieuDocuments(metadata);

    for (const file of dossierFiles) {
        const pathKey = normalizeStorageKey(file.filePath);
        if (file.signedFilePath) {
            signedByPath.set(pathKey, normalizeStorageKey(file.signedFilePath));
        }
    }

    for (const file of dossierFiles) {
        if (!isPdfPath(file.filePath) && !isPdfPath(file.fileName)) {
            continue;
        }

        const storageKey = normalizeStorageKey(file.filePath);
        const downloadKey = signedByPath.get(storageKey);
        sources.set(storageKey, {
            storageKey,
            fileName: file.fileName,
            ...(downloadKey
                ? { downloadKey, preserveSignature: true as const }
                : {}),
        });
    }

    const allowedStorageKeys = new Set(
        dossierFiles.map((f) => normalizeStorageKey(f.filePath)),
    );

    for (const group of expanded.metadata_groups) {
        const filePath = group.source_document?.file_path;
        if (!filePath || !isPdfPath(filePath)) {
            continue;
        }

        const storageKey = normalizeStorageKey(filePath);
        if (dossierFiles.length > 0 && !allowedStorageKeys.has(storageKey)) {
            continue;
        }

        const fileName =
            group.source_document?.file_name ?? storageBasename(filePath);
        const downloadKey = signedByPath.get(storageKey);
        const existing = sources.get(storageKey);
        sources.set(storageKey, {
            storageKey,
            fileName: existing?.fileName ?? fileName,
            ...(downloadKey
                ? { downloadKey, preserveSignature: true as const }
                : existing?.preserveSignature
                ? {
                    downloadKey: existing.downloadKey,
                    preserveSignature: true as const,
                }
                : {}),
        });
    }

    return [...sources.values()];
}

export interface DossierMetadataExportBundle {
    dossierFolderName: string;
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}

export interface FolderDossierPdfBundle {
    /** Nested ZIP folder path preserving warehouse hierarchy (e.g. A/B/HoSo). */
    dossierFolderName: string;
    zipFolderPath?: string;
    /** Đường dẫn thư mục tương đối từ baseFolderPath, dùng để tạo cấu trúc thư mục trong ZIP */
    relativeFolderPath?: string;
    /** Tên thư mục gốc (baseFolderName) mà user đã chọn xuất */
    baseFolderName?: string;
    pdfFiles: MetadataExportPdfFile[];
    /** Parallel to pdfFiles: same stem, `.TIFF` extension. */
    tiffFiles?: MetadataExportPdfFile[];
}

/** Resolve unique folder prefix under PDF/ and TIFF/ for one dossier. */
export function resolveMetadataExportFolderPrefix(
    bundle: Pick<
        FolderDossierPdfBundle,
        | "dossierFolderName"
        | "zipFolderPath"
        | "relativeFolderPath"
        | "baseFolderName"
    >,
    usedFolderNames: Set<string>,
): string {
    if (bundle.baseFolderName && bundle.relativeFolderPath !== undefined) {
        const cleanBase = sanitizeFolderPathForZip(bundle.baseFolderName);
        const cleanRel = sanitizeFolderPathForZip(bundle.relativeFolderPath);
        return uniqueZipFolderPath(
            cleanRel ? `${cleanBase}/${cleanRel}` : cleanBase,
            usedFolderNames,
        );
    }
    return uniqueZipFolderPath(
        bundle.zipFolderPath || bundle.dossierFolderName,
        usedFolderNames,
    );
}

export function collectFolderMetadataExportEntries(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
}): Array<{ name: string; data: Uint8Array }> {
    const entries: Array<{ name: string; data: Uint8Array }> = [
        { name: input.excelFileName, data: input.excelBuffer },
    ];
    const usedFolderNames = new Set<string>();
    for (const bundle of input.dossierPdfBundles) {
        const folderPrefix = resolveMetadataExportFolderPrefix(
            bundle,
            usedFolderNames,
        );
        const usedPdfNames = new Set<string>();
        const tiffFiles = bundle.tiffFiles ?? [];
        for (let i = 0; i < bundle.pdfFiles.length; i++) {
            const pdf = bundle.pdfFiles[i]!;
            const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
            entries.push({
                name: `PDF/${folderPrefix}/${entryName}`,
                data: pdf.data,
            });
            pdf.data = new Uint8Array(0);

            const tiff = tiffFiles[i];
            if (tiff) {
                const tiffEntryName = entryName.replace(/\.pdf$/i, ".TIFF");
                entries.push({
                    name: `TIFF/${folderPrefix}/${tiffEntryName}`,
                    data: tiff.data,
                });
                tiff.data = new Uint8Array(0);
            }
        }
        bundle.pdfFiles.length = 0;
        if (bundle.tiffFiles) {
            bundle.tiffFiles.length = 0;
        }
    }
    return entries;
}

/** ZIP: Excel at root + parallel PDF/ and TIFF/ trees preserving folder hierarchy. */
export async function buildFolderMetadataExportZipStream(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
    password?: string;
}): Promise<ReadableStream<Uint8Array>> {
    const entries = collectFolderMetadataExportEntries(input);
    return streamZipWhileBuilding(
        async (zip) => {
            for (const entry of entries) {
                await zip.add(entry.name, entry.data);
                entry.data = new Uint8Array(0);
            }
        },
        { password: input.password },
    );
}

/**
 * Build metadata export ZIP while processing dossiers via `appendDossier`.
 * Excel is written first (unless omitExcel); caller adds PDF/TIFF entries one file at a time.
 */
export function buildFolderMetadataExportZipStreamIncremental(input: {
    excelFileName?: string;
    excelBuffer?: Uint8Array;
    omitExcel?: boolean;
    password?: string;
    build: (
        add: (name: string, data: Uint8Array) => Promise<void>,
        usedFolderNames: Set<string>,
    ) => Promise<void>;
}): ReadableStream<Uint8Array> {
    const usedFolderNames = new Set<string>();
    return streamZipWhileBuilding(
        async (zip) => {
            if (
                !input.omitExcel &&
                input.excelFileName &&
                input.excelBuffer
            ) {
                await zip.add(input.excelFileName, input.excelBuffer);
            }
            await input.build(zip.add.bind(zip), usedFolderNames);
        },
        { password: input.password },
    );
}

export async function buildFolderMetadataExportZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
    password?: string;
}): Promise<Uint8Array> {
    return await readableStreamToUint8Array(
        await buildFolderMetadataExportZipStream(input),
    );
}

export { uniqueZipEntryName };
