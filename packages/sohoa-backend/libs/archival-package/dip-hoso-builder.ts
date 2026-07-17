import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import { resolveDipZipFileName } from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { encodeUtf8, uniqueZipEntryName } from "./zip-utils.ts";
import { encryptedZipEntriesToReadableStream } from "../encrypted-zip-stream.ts";
import {
    jszipToReadableStream,
    readableStreamToUint8Array,
} from "../jszip-stream.ts";

function collectSingleDipEntries(
    input: PackageBuildInput,
    folderPrefix = "",
): Array<{ name: string; data: Uint8Array }> {
    const prefix = folderPrefix ? `${folderPrefix}/` : "";
    const hosoXml = buildHosoXmlFromMetadata(input.metadata, input.hoSoId, "DIP_hoso");
    const entries: Array<{ name: string; data: Uint8Array }> = [
        { name: `${prefix}hoso.xml`, data: encodeUtf8(hosoXml) },
    ];

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        entries.push({
            name: `${prefix}documents/${entryName}`,
            data: pdf.data,
        });
        pdf.data = new Uint8Array(0);
    }
    input.pdfFiles.length = 0;
    return entries;
}

function appendSingleDipToZip(zip: JSZip, input: PackageBuildInput, folderPrefix = ""): void {
    for (const entry of collectSingleDipEntries(input, folderPrefix)) {
        zip.file(entry.name, entry.data);
    }
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
 * When password is set, builds AES-encrypted ZIP via @zip.js/zip.js.
 */
export async function buildDipExportZipStream(
    packages: PackageBuildInput[],
    password?: string,
): Promise<DipZipStreamResult> {
    if (password?.trim()) {
        const entries: Array<{ name: string; data: Uint8Array }> = [];
        if (packages.length === 1) {
            const only = packages[0]!;
            entries.push(...collectSingleDipEntries(only));
            return {
                stream: await encryptedZipEntriesToReadableStream(entries, password),
                filename: resolveDipZipFileName(only.hoSoId),
                contentType: "application/zip",
                exportedCount: 1,
            };
        }

        const usedFolderNames = new Set<string>();
        for (const input of packages) {
            const folderName = uniqueZipEntryName(input.hoSoId, usedFolderNames);
            entries.push(...collectSingleDipEntries(input, folderName));
        }
        return {
            stream: await encryptedZipEntriesToReadableStream(entries, password),
            filename: "multi-dip-export.zip",
            contentType: "application/zip",
            exportedCount: packages.length,
        };
    }

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
