import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import {
    resolveDipZipFileName,
    uniqueZipFolderPath,
} from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { encodeUtf8, uniqueZipEntryName, sanitizeFolderPathForZip } from "./zip-utils.ts";
import {
    jszipToReadableStream,
    readableStreamToUint8Array,
} from "../jszip-stream.ts";
import { streamZipWhileBuilding } from "../streaming-zip-writer.ts";

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
export function collectSingleDipEntries(
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
 * Stream DIP ZIP while packages are produced one-by-one via `build`.
 * Each package's PDF buffers are cleared after being added to the ZIP.
 */
export function buildDipExportZipStreamIncremental(input: {
    password?: string;
    filename: string;
    exportedCount: number;
    build: (
        addPackage: (
            pkg: PackageBuildInput,
            options?: { outerFolder?: string; xmlAtRoot?: boolean },
        ) => Promise<void>,
        usedFolderNames: Set<string>,
    ) => Promise<void>;
}): DipZipStreamResult {
    const usedFolderNames = new Set<string>();
    const stream = streamZipWhileBuilding(
        async (zip) => {
            await input.build(async (pkg, options) => {
                const entries = collectSingleDipEntries(
                    pkg,
                    options?.outerFolder ?? "",
                    options?.xmlAtRoot ?? false,
                );
                for (const entry of entries) {
                    await zip.add(entry.name, entry.data);
                    entry.data = new Uint8Array(0);
                }
            }, usedFolderNames);
        },
        { password: input.password },
    );

    return {
        stream,
        filename: input.filename,
        contentType: "application/zip",
        exportedCount: input.exportedCount,
    };
}

/**
 * Incrementally add packages into one streaming ZIP.
 * Mutates inputs (clears pdf data after each append) to free RAM early.
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
    if (packages.length === 0) {
        throw new Error("At least one DIP package is required");
    }

    const only = packages[0]!;
    const isFolderExport = Boolean(only.folderName);
    const filename = packages.length === 1
        ? (only.folderName
            ? resolveDipZipFileName(only.folderName)
            : resolveDipZipFileName(only.hoSoId))
        : (only.folderName
            ? resolveDipZipFileName(only.folderName)
            : "multi-dip-export.zip");

    return buildDipExportZipStreamIncremental({
        password,
        filename,
        exportedCount: packages.length,
        build: async (addPackage, usedFolderNames) => {
            if (packages.length === 1) {
                await addPackage(only, {
                    outerFolder: "",
                    xmlAtRoot: Boolean(only.folderName),
                });
                return;
            }

            for (const input of packages) {
                const outerFolder = isFolderExport
                    ? ""
                    : uniqueZipFolderPath(
                        resolvePackageZipFolderPath(input),
                        usedFolderNames,
                    );
                await addPackage(input, { outerFolder });
            }
        },
    });
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
