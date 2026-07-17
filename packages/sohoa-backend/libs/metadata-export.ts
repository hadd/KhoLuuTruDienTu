import JSZip from "jszip";
import type { DossierMetadata } from "./metadata-types.ts";
import { normalizeStorageKey, storageBasename } from "../modules/dossier/dossier-path-utils.ts";
import { encryptedZipEntriesToReadableStream } from "./encrypted-zip-stream.ts";
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

function collectMetadataExportEntries(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}): Array<{ name: string; data: Uint8Array }> {
    const entries: Array<{ name: string; data: Uint8Array }> = [
        { name: input.excelFileName, data: input.excelBuffer },
    ];
    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        entries.push({ name: `pdfs/${entryName}`, data: pdf.data });
        pdf.data = new Uint8Array(0);
    }
    input.pdfFiles.length = 0;
    return entries;
}

function buildMetadataExportJsZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}): JSZip {
    const zip = new JSZip();
    for (const entry of collectMetadataExportEntries(input)) {
        zip.file(entry.name, entry.data);
    }
    return zip;
}

export async function buildMetadataExportZipStream(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
    password?: string;
}): Promise<ReadableStream<Uint8Array>> {
    if (input.password?.trim()) {
        return await encryptedZipEntriesToReadableStream(
            collectMetadataExportEntries(input),
            input.password,
        );
    }
    return jszipToReadableStream(buildMetadataExportJsZip(input));
}

export async function buildMetadataExportZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
    password?: string;
}): Promise<Uint8Array> {
    return await readableStreamToUint8Array(await buildMetadataExportZipStream(input));
}

export interface FolderDossierPdfBundle {
    dossierFolderName: string;
    pdfFiles: MetadataExportPdfFile[];
}

function collectFolderMetadataExportEntries(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
}): Array<{ name: string; data: Uint8Array }> {
    const entries: Array<{ name: string; data: Uint8Array }> = [
        { name: input.excelFileName, data: input.excelBuffer },
    ];
    const usedFolderNames = new Set<string>();
    for (const bundle of input.dossierPdfBundles) {
        const folderName = uniqueZipEntryName(bundle.dossierFolderName, usedFolderNames);
        const usedPdfNames = new Set<string>();
        for (const pdf of bundle.pdfFiles) {
            const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
            entries.push({
                name: `${folderName}/pdfs/${entryName}`,
                data: pdf.data,
            });
            pdf.data = new Uint8Array(0);
        }
        bundle.pdfFiles.length = 0;
    }
    return entries;
}

function buildFolderMetadataExportJsZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
}): JSZip {
    const zip = new JSZip();
    for (const entry of collectFolderMetadataExportEntries(input)) {
        zip.file(entry.name, entry.data);
    }
    return zip;
}

/** ZIP gồm một Excel tổng hợp ở gốc và PDF theo từng thư mục hồ sơ. */
export async function buildFolderMetadataExportZipStream(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    dossierPdfBundles: FolderDossierPdfBundle[];
    password?: string;
}): Promise<ReadableStream<Uint8Array>> {
    if (input.password?.trim()) {
        return await encryptedZipEntriesToReadableStream(
            collectFolderMetadataExportEntries(input),
            input.password,
        );
    }
    return jszipToReadableStream(buildFolderMetadataExportJsZip(input));
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
