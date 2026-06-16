import JSZip from "jszip";
import { buildHosoXmlFromMetadata } from "./field-mapper.ts";
import { resolveDipZipFileName } from "./aip-path-utils.ts";
import type { PackageBuildInput, PackageBuildResult } from "./package-types.ts";
import { encodeUtf8, uniqueZipEntryName } from "./zip-utils.ts";

export async function buildDipHosoPackage(input: PackageBuildInput): Promise<PackageBuildResult> {
    const zip = new JSZip();

    const hosoXml = buildHosoXmlFromMetadata(input.metadata, input.hoSoId, "DIP_hoso");
    zip.file("hoso.xml", encodeUtf8(hosoXml));

    const usedPdfNames = new Set<string>();
    for (const pdf of input.pdfFiles) {
        const entryName = uniqueZipEntryName(pdf.fileName, usedPdfNames);
        zip.file(`documents/${entryName}`, pdf.data);
    }

    const buffer = await zip.generateAsync({ type: "uint8array" });
    return {
        buffer: new Uint8Array(buffer),
        filename: resolveDipZipFileName(input.hoSoId),
        manifestLines: [],
    };
}
