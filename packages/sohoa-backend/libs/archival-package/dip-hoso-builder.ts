import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import { resolveDipZipFileName } from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { encodeUtf8, uniqueZipEntryName } from "./zip-utils.ts";
import {
    jszipToReadableStream,
    readableStreamToUint8Array,
} from "../jszip-stream.ts";

function appendSingleDipToZip(zip: JSZip, input: PackageBuildInput, folderPrefix = ""): void {
    const prefix = folderPrefix ? `${folderPrefix}/` : "";
    const hosoXml = buildHosoXmlFromMetadata(input.metadata, input.hoSoId, "DIP_hoso");
    zip.file(`${prefix}hoso.xml`, encodeUtf8(hosoXml));

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        zip.file(`${prefix}documents/${entryName}`, pdf.data);
        // Drop local ref after JSZip has taken the content reference.
        pdf.data = new Uint8Array(0);
    }
    input.pdfFiles.length = 0;
}

export async function buildDipHosoPackage(input: PackageBuildInput): Promise<PackageBuildResult> {
    const zip = new JSZip();
    appendSingleDipToZip(zip, input);

    const stream = jszipToReadableStream(zip);
    const buffer = await readableStreamToUint8Array(stream);
    return {
        buffer,
        filename: resolveDipZipFileName(input.hoSoId),
        manifestLines: [],
    };
}

/** Outer ZIP with one folder per hồ sơ: `{hoSoId}/hoso.xml` + `{hoSoId}/documents/*.pdf`. */
export async function buildMultiDipHosoZip(
    packages: PackageBuildInput[],
): Promise<PackageBuildResult> {
    const zip = new JSZip();
    const usedFolderNames = new Set<string>();

    for (const input of packages) {
        const folderName = uniqueZipEntryName(input.hoSoId, usedFolderNames);
        appendSingleDipToZip(zip, input, folderName);
    }

    const stream = jszipToReadableStream(zip);
    const buffer = await readableStreamToUint8Array(stream);
    return {
        buffer,
        filename: "multi-dip-export.zip",
        manifestLines: [],
    };
}

export type DipZipStreamResult = {
    stream: ReadableStream<Uint8Array>;
    filename: string;
    contentType: "application/zip";
    exportedCount: number;
};

/**
 * Incrementally add packages into one JSZip then return a streaming response body.
 * Mutates inputs (clears pdf data after each append) to free RAM early.
 */
export function buildDipExportZipStream(
    packages: PackageBuildInput[],
): DipZipStreamResult {
    const zip = new JSZip();

    if (packages.length === 1) {
        const only = packages[0]!;
        appendSingleDipToZip(zip, only);
        return {
            stream: jszipToReadableStream(zip),
            filename: resolveDipZipFileName(only.hoSoId),
            contentType: "application/zip",
            exportedCount: 1,
        };
    }

    const usedFolderNames = new Set<string>();
    for (const input of packages) {
        const folderName = uniqueZipEntryName(input.hoSoId, usedFolderNames);
        appendSingleDipToZip(zip, input, folderName);
    }

    return {
        stream: jszipToReadableStream(zip),
        filename: "multi-dip-export.zip",
        contentType: "application/zip",
        exportedCount: packages.length,
    };
}

/** Add one DIP package into an existing multi-dossier ZIP (folder per hoSoId). */
export function appendDipPackageToMultiZip(
    zip: JSZip,
    input: PackageBuildInput,
    usedFolderNames: Set<string>,
): void {
    const folderName = uniqueZipEntryName(input.hoSoId, usedFolderNames);
    appendSingleDipToZip(zip, input, folderName);
}
