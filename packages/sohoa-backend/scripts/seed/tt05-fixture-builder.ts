import type { DossierMetadata } from "../../libs/metadata-types.ts";
import { toProcessedMetadataKey } from "../../modules/dossier/dossier-path-utils.ts";

export const TT05_TEMPLATE_PATH = new URL(
  "../../assets/TT05.json",
  import.meta.url,
);

export type PdfFileRef = {
  fileName: string;
  filePath: string;
};

export function normalizeFolderPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function buildFilePath(folderPath: string, fileName: string): string {
  const base = normalizeFolderPath(folderPath);
  return `${base}/${fileName}`;
}

export async function loadTt05Template(): Promise<DossierMetadata> {
  return JSON.parse(
    await Deno.readTextFile(TT05_TEMPLATE_PATH),
  ) as DossierMetadata;
}

/** Default PDF names when no dossier files exist in DB. */
export function buildDefaultPdfFiles(
  folderPath: string,
  hoSoId: string,
  documentCount = 2,
): PdfFileRef[] {
  const files: PdfFileRef[] = [
    {
      fileName: `phong_${hoSoId}.pdf`,
      filePath: buildFilePath(folderPath, `phong_${hoSoId}.pdf`),
    },
    {
      fileName: `bia_ho_so_${hoSoId}.pdf`,
      filePath: buildFilePath(folderPath, `bia_ho_so_${hoSoId}.pdf`),
    },
  ];

  for (let index = 0; index < documentCount; index++) {
    const fileName = `document_${index + 1}.pdf`;
    files.push({
      fileName,
      filePath: buildFilePath(folderPath, fileName),
    });
  }

  return files;
}

/** Minimal valid PDF for fake dossiers (pdf.js can render a blank page). */
export function buildMinimalPdfBytes(label = "FAKE"): Uint8Array {
  const safeLabel = label.replace(/[()\\]/g, " ").slice(0, 60);
  const stream = `BT /F1 12 Tf 50 700 Td (${safeLabel}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${stream.length}>>stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000226 00000 n 
0000000320 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
400
%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function customizeTt05Metadata(
  template: DossierMetadata,
  input: {
    hoSoId: string;
    folderPath: string;
    pdfFiles: Array<PdfFileRef>;
  },
): DossierMetadata {
  const metadata = structuredClone(template) as DossierMetadata;
  metadata.ho_so_id = input.hoSoId;
  metadata.trang_thai_ho_so = metadata.trang_thai_ho_so ?? "Đã số hóa";

  const pdfFiles = input.pdfFiles.filter((file) =>
    file.fileName.toLowerCase().endsWith(".pdf")
  );
  const pickPdf = (index: number, fallbackName: string) => {
    const file = pdfFiles[index];
    if (!file) {
      return {
        file_name: fallbackName,
        file_path: buildFilePath(input.folderPath, fallbackName),
      };
    }
    return {
      file_name: file.fileName,
      file_path: file.filePath,
    };
  };

  for (const group of metadata.metadata_groups) {
    if (group.group_code === "PHONG_LUU_TRU") {
      group.source_document = pickPdf(0, `phong_${input.hoSoId}.pdf`);
      continue;
    }

    if (group.group_code === "HO_SO_LUU_TRU") {
      const biaFile = pdfFiles.find((file) =>
        /bia.*ho.*so/i.test(file.fileName)
      ) ?? pdfFiles[0];
      group.source_document = biaFile
        ? { file_name: biaFile.fileName, file_path: biaFile.filePath }
        : pickPdf(0, `bia_ho_so_${input.hoSoId}.pdf`);
      continue;
    }

    if (group.group_code === "TAI_LIEU_LUU_TRU" && group.documents?.length) {
      const docCandidates = pdfFiles.filter((file) =>
        !/bia.*ho.*so|phong_/i.test(file.fileName)
      );
      group.documents = group.documents.map((item, index) => {
        const file = docCandidates[index] ?? pdfFiles[index + 1] ??
          pdfFiles[index];
        return {
          ...item,
          source_document: file
            ? { file_name: file.fileName, file_path: file.filePath }
            : pickPdf(index, `document_${index + 1}.pdf`),
        };
      });
    }
  }

  return metadata;
}

export function resolveProcessedMetadataKey(folderPath: string): string {
  const processedKey = toProcessedMetadataKey(folderPath);
  if (!processedKey) {
    throw new Error(`Cannot derive processed metadata key from ${folderPath}`);
  }
  return processedKey;
}

export async function writeTt05FixtureToLocal(
  metadata: DossierMetadata,
  input: {
    folderPath: string;
    outputDir: string;
  },
): Promise<{ processedKey: string; localPath: string }> {
  const processedKey = resolveProcessedMetadataKey(input.folderPath);
  const localPath = `${normalizeFolderPath(input.outputDir)}/${processedKey}`;
  await Deno.mkdir(localPath.replace(/\/[^/]+$/, ""), { recursive: true });
  await Deno.writeTextFile(
    localPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  return { processedKey, localPath };
}
