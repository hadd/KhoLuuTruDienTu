import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import {
    resolveDipZipFileName,
    uniqueZipFolderPath,
} from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { encodeUtf8, uniqueZipEntryName, sanitizeFolderPathForZip } from "./zip-utils.ts";
import { encryptedZipEntriesToReadableStream } from "../encrypted-zip-stream.ts";
import {
    jszipToReadableStream,
    readableStreamToUint8Array,
} from "../jszip-stream.ts";

function resolvePackageZipFolderPath(input: PackageBuildInput): string {
    return input.zipFolderPath?.trim() || input.hoSoId;
}

/**
 * Tạo entries ZIP cho một hồ sơ DIP.
 *
 * Cấu trúc mục tiêu (xuất từ folder):
 *   hoso.xml                        ← ở root ZIP
 *   <folderName>/
 *     <relativeContentPath>/        ← đường dẫn tương đối (từ folderPath), nếu có
 *       file.pdf
 *
 * Cấu trúc mục tiêu (xuất hồ sơ đơn lẻ / multi theo warehouse):
 *   <outerFolder>/
 *     hoso.xml
 *     documents/
 *       file.pdf
 */
function collectSingleDipEntries(
    input: PackageBuildInput,
    outerFolder = "",
    xmlAtRoot = false,
): Array<{ name: string; data: Uint8Array }> {
    const outer = outerFolder ? `${outerFolder}/` : "";
    const hosoXml = buildHosoXmlFromMetadata(input.metadata, input.hoSoId, "DIP_hoso");

    if (input.folderName) {
        const entries: Array<{ name: string; data: Uint8Array }> = [
            { name: "hoso.xml", data: encodeUtf8(hosoXml) },
        ];
        const cleanRelPath = sanitizeFolderPathForZip(input.folderPath ?? "");
        const cleanFolderName = sanitizeFolderPathForZip(input.folderName);
        const folderBase = cleanFolderName ? `${outer}${cleanFolderName}/` : outer;
        const contentDir = cleanRelPath ? `${folderBase}${cleanRelPath}/` : folderBase;

        const usedPdfNames = new Set<string>();
        for (const pdf of input.pdfFiles) {
            const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
            entries.push({
                name: `${contentDir}${entryName}`,
                data: pdf.data,
            });
            pdf.data = new Uint8Array(0);
        }
        input.pdfFiles.length = 0;
        return entries;
    }

    const hosoXmlPath = xmlAtRoot ? "hoso.xml" : `${outer}hoso.xml`;
    const entries: Array<{ name: string; data: Uint8Array }> = [
        { name: hosoXmlPath, data: encodeUtf8(hosoXml) },
    ];

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        entries.push({
            name: `${outer}documents/${entryName}`,
            data: pdf.data,
        });
        pdf.data = new Uint8Array(0);
    }
    input.pdfFiles.length = 0;
    return entries;
}

function appendSingleDipToZip(zip: JSZip, input: PackageBuildInput, outerFolder = "", xmlAtRoot = false): void {
    for (const entry of collectSingleDipEntries(input, outerFolder, xmlAtRoot)) {
        zip.file(entry.name, entry.data);
    }
}

export async function buildDipHosoPackage(input: PackageBuildInput): Promise<PackageBuildResult> {
    const zip = new JSZip();
    appendSingleDipToZip(zip, input, "", true);

    const stream = jszipToReadableStream(zip);
    const buffer = await readableStreamToUint8Array(stream);
    return {
        buffer,
        filename: resolveDipZipFileName(input.hoSoId),
        manifestLines: [],
    };
}

/** Outer ZIP with one folder per hồ sơ, preserving warehouse relative paths. */
export async function buildMultiDipHosoZip(
    packages: PackageBuildInput[],
): Promise<PackageBuildResult> {
    const zip = new JSZip();
    const usedFolderNames = new Set<string>();

    for (const input of packages) {
        const folderName = uniqueZipFolderPath(
            resolvePackageZipFolderPath(input),
            usedFolderNames,
        );
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
    zipPasswordSource?: "personal_pin" | "dossier" | "none";
};

/**
 * Incrementally add packages into one JSZip then return a streaming response body.
 * Mutates inputs (clears pdf data after each append) to free RAM early.
 * When password is set, builds AES-encrypted ZIP via @zip.js/zip.js.
 *
 * Cấu trúc ZIP:
 *   Xuất folder: hoso.xml ở root + <folderName>/<relPath>/<file>.pdf
 *   Một hồ sơ:   <hoSoId>/hoso.xml  +  <hoSoId>/documents/<file>.pdf
 *   Nhiều hồ sơ: <zipFolderPath hoặc hoSoId>/...
 */
export async function buildDipExportZipStream(
    packages: PackageBuildInput[],
    password?: string,
): Promise<DipZipStreamResult> {
    if (password?.trim()) {
        const entries: Array<{ name: string; data: Uint8Array }> = [];
        if (packages.length === 1) {
            const only = packages[0]!;
            entries.push(...collectSingleDipEntries(only, "", Boolean(only.folderName)));
            const zipFileName = only.folderName
                ? resolveDipZipFileName(only.folderName)
                : resolveDipZipFileName(only.hoSoId);
            return {
                stream: await encryptedZipEntriesToReadableStream(entries, password),
                filename: zipFileName,
                contentType: "application/zip",
                exportedCount: 1,
            };
        }

        const usedFolderNames = new Set<string>();
        const isFolderExport = Boolean(packages[0]?.folderName);
        for (const input of packages) {
            const outerFolder = isFolderExport
                ? ""
                : uniqueZipFolderPath(resolvePackageZipFolderPath(input), usedFolderNames);
            entries.push(...collectSingleDipEntries(input, outerFolder));
        }
        const commonFolderName = packages[0]?.folderName;
        return {
            stream: await encryptedZipEntriesToReadableStream(entries, password),
            filename: commonFolderName ? resolveDipZipFileName(commonFolderName) : "multi-dip-export.zip",
            contentType: "application/zip",
            exportedCount: packages.length,
        };
    }

    const zip = new JSZip();

    if (packages.length === 1) {
        const only = packages[0]!;
        appendSingleDipToZip(zip, only, "", Boolean(only.folderName));
        const zipFileName = only.folderName
            ? resolveDipZipFileName(only.folderName)
            : resolveDipZipFileName(only.hoSoId);
        return {
            stream: jszipToReadableStream(zip),
            filename: zipFileName,
            contentType: "application/zip",
            exportedCount: 1,
        };
    }

    const usedFolderNames = new Set<string>();
    const isFolderExport = Boolean(packages[0]?.folderName);
    for (const input of packages) {
        const outerFolder = isFolderExport
            ? ""
            : uniqueZipFolderPath(resolvePackageZipFolderPath(input), usedFolderNames);
        appendSingleDipToZip(zip, input, outerFolder);
    }
    const commonFolderName = packages[0]?.folderName;
    return {
        stream: jszipToReadableStream(zip),
        filename: commonFolderName ? resolveDipZipFileName(commonFolderName) : "multi-dip-export.zip",
        contentType: "application/zip",
        exportedCount: packages.length,
    };
}

/** Add one DIP package into an existing multi-dossier ZIP (folder per path/hoSoId). */
export function appendDipPackageToMultiZip(
    zip: JSZip,
    input: PackageBuildInput,
    usedFolderNames: Set<string>,
): void {
    const folderName = uniqueZipFolderPath(
        resolvePackageZipFolderPath(input),
        usedFolderNames,
    );
    appendSingleDipToZip(zip, input, folderName);
}
