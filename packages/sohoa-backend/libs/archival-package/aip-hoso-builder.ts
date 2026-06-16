import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import { resolveAipZipFileName } from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { buildManifestLines, encodeUtf8, uniqueZipEntryName } from "./zip-utils.ts";

export async function buildAipHosoPackage(input: PackageBuildInput): Promise<PackageBuildResult> {
    const zip = new JSZip();
    const manifestEntries: Array<{ path: string; data: Uint8Array }> = [];

    const hosoXml = buildHosoXmlFromMetadata(input.metadata, input.hoSoId, "AIP_hoso");
    const hosoXmlPath = "metadata/hoso.xml";
    const hosoXmlData = encodeUtf8(hosoXml);
    zip.file(hosoXmlPath, hosoXmlData);
    manifestEntries.push({ path: hosoXmlPath, data: hosoXmlData });

    const metadataJsonPath = "metadata.json";
    const metadataJsonData = encodeUtf8(JSON.stringify(input.metadata, null, 2));
    zip.file(metadataJsonPath, metadataJsonData);
    manifestEntries.push({ path: metadataJsonPath, data: metadataJsonData });

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const groupFolder = pdf.groupCode
            ? `representations/${pdf.groupCode.replace(/[^a-zA-Z0-9._-]/g, "_")}`
            : "representations/_ungrouped";
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        const zipPath = `${groupFolder}/${entryName}`;
        zip.file(zipPath, pdf.data);
        manifestEntries.push({ path: zipPath, data: pdf.data });
    }

    const manifestLines = await buildManifestLines(manifestEntries);
    const manifestPath = "manifest-sha256.txt";
    const manifestData = encodeUtf8(manifestLines.join("\n") + "\n");
    zip.file(manifestPath, manifestData);

    const buffer = await zip.generateAsync({ type: "uint8array" });
    return {
        buffer: new Uint8Array(buffer),
        filename: resolveAipZipFileName(input.hoSoId),
        manifestLines,
    };
}
