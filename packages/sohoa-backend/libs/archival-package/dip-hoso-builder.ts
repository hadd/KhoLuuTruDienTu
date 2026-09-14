import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import { resolveDipZipFileName } from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { encodeUtf8, uniqueZipEntryName, sanitizeFolderPathForZip } from "./zip-utils.ts";
import { encryptedZipEntriesToReadableStream } from "../encrypted-zip-stream.ts";
import {
    jszipToReadableStream,
    readableStreamToUint8Array,
} from "../jszip-stream.ts";

/**
 * Tạo entries ZIP cho một hồ sơ DIP.
 *
 * Cấu trúc mục tiêu (xuất từ folder):
 *   hoso.xml                        ← ở root ZIP
 *   <folderName>/
 *     <relativeContentPath>/        ← đường dẫn tương đối (từ folderPath), nếu có
 *       file.pdf
 *
 * Cấu trúc mục tiêu (xuất hồ sơ đơn lẻ):
 *   <outerFolder>/
 *     hoso.xml
 *     documents/
 *       file.pdf
 *
 * - outerFolder: tên thư mục bao ngoài (thường là hoSoId), "" = đặt thẳng ở root zip
 * - input.folderPath:
 *   + undefined → dùng "documents/" (backward compat, xuất hồ sơ đơn lẻ)
 *   + "" → file nằm thẳng trong outerFolder/
 *   + "0964" hoặc "A/B" → file nằm trong outerFolder/0964/ hay outerFolder/A/B/
 */
function collectSingleDipEntries(
    input: PackageBuildInput,
    outerFolder = "",
    xmlAtRoot = false,
): Array<{ name: string; data: Uint8Array }> {
    const outer = outerFolder ? `${outerFolder}/` : "";
    const hosoXml = buildHosoXmlFromMetadata(input.metadata, input.hoSoId, "DIP_hoso");

    // Khi xuất từ folder hoặc có cờ xmlAtRoot: hoso.xml luôn ở root ZIP (con trực tiếp của file ZIP)
    const hosoXmlPath = (input.folderName || xmlAtRoot) ? "hoso.xml" : `${outer}hoso.xml`;
    const entries: Array<{ name: string; data: Uint8Array }> = [
        { name: hosoXmlPath, data: encodeUtf8(hosoXml) },
    ];

    // Xác định thư mục chứa file PDF bên trong outerFolder
    // Cấu trúc:
    //   Nếu folderName có (xuất từ folder):
    //     hoso.xml                           ← ở root ZIP
    //     {folderName}/{relativePath}/file.pdf
    //   Nếu không (xuất hồ sơ đơn lẻ):
    //     outerFolder/hoso.xml
    //     outerFolder/documents/file.pdf  (backward compat)
    let contentDir: string;
    if (input.folderPath === undefined) {
        // Xuất hồ sơ đơn lẻ (không qua folder)
        contentDir = outer;
    } else {
        const cleanRelPath = sanitizeFolderPathForZip(input.folderPath);
        if (input.folderName) {
            // Xuất từ folder: files vào outerFolder/{folderName}/{relativePath}/
            const cleanFolderName = sanitizeFolderPathForZip(input.folderName);
            const folderBase = cleanFolderName ? `${outer}${cleanFolderName}/` : outer;
            contentDir = cleanRelPath ? `${folderBase}${cleanRelPath}/` : folderBase;
        } else {
            // Có folderPath nhưng không có folderName → đặt thẳng theo relativePath
            contentDir = cleanRelPath ? `${outer}${cleanRelPath}/` : outer;
        }
    }

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
    zipPasswordSource?: "personal_pin" | "dossier" | "none";
};

/**
 * Incrementally add packages into one JSZip then return a streaming response body.
 * Mutates inputs (clears pdf data after each append) to free RAM early.
 * When password is set, builds AES-encrypted ZIP via @zip.js/zip.js.
 *
 * Cấu trúc ZIP:
 *   Một hồ sơ:   <hoSoId>/hoso.xml  +  <hoSoId>/<relFolderPath>/<file>.pdf
 *   Nhiều hồ sơ: <hoSoId1>/...  <hoSoId2>/...
 */
export async function buildDipExportZipStream(
    packages: PackageBuildInput[],
    password?: string,
): Promise<DipZipStreamResult> {
    if (password?.trim()) {
        const entries: Array<{ name: string; data: Uint8Array }> = [];
        if (packages.length === 1) {
            const only = packages[0]!;
            // Khi xuất từ folder: hoso.xml + folderName/ ở root ZIP (outerFolder = "")
            // Khi xuất hồ sơ đơn lẻ: bọc trong hoSoId/ (outerFolder = hoSoId)
            const outerFolder = only.folderName ? "" : only.hoSoId;
            entries.push(...collectSingleDipEntries(only, outerFolder, true));
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
            const outerFolder = isFolderExport ? "" : uniqueZipEntryName(input.hoSoId, usedFolderNames);
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
        const outerFolder = only.folderName ? "" : only.hoSoId;
        appendSingleDipToZip(zip, only, outerFolder, true);
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
        const outerFolder = isFolderExport ? "" : uniqueZipEntryName(input.hoSoId, usedFolderNames);
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

/** Add one DIP package into an existing multi-dossier ZIP (folder per hoSoId). */
export function appendDipPackageToMultiZip(
    zip: JSZip,
    input: PackageBuildInput,
    usedFolderNames: Set<string>,
): void {
    const outerFolder = uniqueZipEntryName(input.hoSoId, usedFolderNames);
    appendSingleDipToZip(zip, input, outerFolder);
}


