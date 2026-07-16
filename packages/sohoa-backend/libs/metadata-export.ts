import JSZip from "jszip";
import type { DossierMetadata } from "./metadata-types.ts";
import { normalizeStorageKey, storageBasename } from "../modules/dossier/dossier-path-utils.ts";
import {
    jszipToReadableStream,
    readableStreamToUint8Array,
} from "./jszip-stream.ts";

export interface MetadataPdfSource {
    storageKey: string;
    fileName: string;
}

export interface MetadataExportPdfFile {
    fileName: string;
    data: Uint8Array;
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

export function collectMetadataPdfSources(
    metadata: DossierMetadata,
    dossierFiles: Array<{ fileName: string; filePath: string }> = [],
): MetadataPdfSource[] {
    const sources = new Map<string, string>();

    for (const file of dossierFiles) {
        if (!isPdfPath(file.filePath) && !isPdfPath(file.fileName)) {
            continue;
        }

        sources.set(normalizeStorageKey(file.filePath), file.fileName);
    }

    for (const group of metadata.metadata_groups) {
        const filePath = group.source_document?.file_path;
        if (!filePath || !isPdfPath(filePath)) {
            continue;
        }

        const storageKey = normalizeStorageKey(filePath);
        const fileName = group.source_document?.file_name ?? storageBasename(filePath);
        sources.set(storageKey, fileName);
    }

    return [...sources.entries()].map(([storageKey, fileName]) => ({ storageKey, fileName }));
}

export interface DossierMetadataExportBundle {
    dossierFolderName: string;
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}

function buildMetadataExportJsZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}): JSZip {
    const zip = new JSZip();
    zip.file(input.excelFileName, input.excelBuffer);

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        zip.file(`pdfs/${entryName}`, pdf.data);
        pdf.data = new Uint8Array(0);
    }
    input.pdfFiles.length = 0;
    return zip;
}

export function buildMetadataExportZipStream(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}): ReadableStream<Uint8Array> {
    return jszipToReadableStream(buildMetadataExportJsZip(input));
}

export async function buildMetadataExportZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}): Promise<Uint8Array> {
    return await readableStreamToUint8Array(buildMetadataExportZipStream(input));
}

export interface FolderDossierPdfBundle {
    dossierFolderName: string;
    pdfFiles: MetadataExportPdfFile[];
}

function buildFolderMetadataExportJsZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
}): JSZip {
    const zip = new JSZip();
    zip.file(input.excelFileName, input.excelBuffer);

    const usedFolderNames = new Set<string>();
    for (const bundle of input.dossierPdfBundles) {
        const folderName = uniqueZipEntryName(bundle.dossierFolderName, usedFolderNames);
        const usedPdfNames = new Set<string>();
        for (const pdf of bundle.pdfFiles) {
            const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
            zip.file(`${folderName}/pdfs/${entryName}`, pdf.data);
            pdf.data = new Uint8Array(0);
        }
        bundle.pdfFiles.length = 0;
    }
    return zip;
}

/** ZIP gồm một Excel tổng hợp ở gốc và PDF theo từng thư mục hồ sơ. */
export function buildFolderMetadataExportZipStream(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
}): ReadableStream<Uint8Array> {
    return jszipToReadableStream(buildFolderMetadataExportJsZip(input));
}

export async function buildFolderMetadataExportZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
}): Promise<Uint8Array> {
    return await readableStreamToUint8Array(buildFolderMetadataExportZipStream(input));
}
