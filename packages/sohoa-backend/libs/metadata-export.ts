import JSZip from "jszip";
import type { DossierMetadata } from "./metadata-types.ts";
import { normalizeStorageKey, storageBasename } from "../modules/dossier/dossier-path-utils.ts";

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

export async function buildMetadataExportZip(input: {
    excelFileName: string;
    excelBuffer: Uint8Array;
    pdfFiles: MetadataExportPdfFile[];
}): Promise<Uint8Array> {
    const zip = new JSZip();
    zip.file(input.excelFileName, input.excelBuffer);

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        zip.file(`pdfs/${entryName}`, pdf.data);
    }

    const buffer = await zip.generateAsync({ type: "uint8array" });
    return new Uint8Array(buffer);
}

export async function buildFolderMetadataExportZip(
    bundles: DossierMetadataExportBundle[],
): Promise<Uint8Array> {
    const zip = new JSZip();
    const usedFolderNames = new Set<string>();

    for (const bundle of bundles) {
        const folderName = uniqueZipEntryName(bundle.dossierFolderName, usedFolderNames);
        zip.file(`${folderName}/${bundle.excelFileName}`, bundle.excelBuffer);

        const usedPdfNames = new Set<string>();
        for (const pdf of bundle.pdfFiles) {
            const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
            zip.file(`${folderName}/pdfs/${entryName}`, pdf.data);
        }
    }

    const buffer = await zip.generateAsync({ type: "uint8array" });
    return new Uint8Array(buffer);
}
