import { assertEquals } from "@std/assert";
import { PDFDocument } from "pdf-lib";
import { collectMetadataPdfSources } from "../libs/metadata-export.ts";
import { pdfLooksDigitallySigned } from "../libs/pdf-signature-detect.ts";
import { convertBatchToPdfA } from "../libs/pdf-a/pdf-a-converter.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

function makeFakeSignedPdfBytes(): Uint8Array {
  const body =
    "%PDF-1.7\n" +
    "1 0 obj<< /Type /Catalog /AcroForm << /Fields [] /SigFlags 3 >> >>endobj\n" +
    "2 0 obj<< /Type /Sig /Filter /Adobe.PPKLite /ByteRange [0 100 200 50] /Contents <AABB> >>endobj\n" +
    "trailer<< /Root 1 0 R >>\n" +
    "%%EOF\n";
  return new TextEncoder().encode(body);
}

Deno.test("pdfLooksDigitallySigned detects ByteRange + Type/Sig", () => {
  assertEquals(pdfLooksDigitallySigned(makeFakeSignedPdfBytes()), true);
});

Deno.test("pdfLooksDigitallySigned returns false for unsigned PDF bytes", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const bytes = await doc.save();
  assertEquals(pdfLooksDigitallySigned(bytes), false);
});

Deno.test("convertBatchToPdfA auto-skips PDFs that look digitally signed", async () => {
  const signedLike = makeFakeSignedPdfBytes();
  const input: Array<{
    fileName: string;
    data: Uint8Array;
    preserveSignature?: boolean;
  }> = [{ fileName: "embedded-sig.pdf", data: signedLike }];
  const result = await convertBatchToPdfA(input);
  assertEquals(result[0]!.data, signedLike);
  assertEquals(result[0]!.preserveSignature, true);
});

Deno.test("collectMetadataPdfSources sets preserveSignature when signedFilePath present", () => {
  const metadata: DossierMetadata = {
    ho_so_id: "HS-001",
    metadata_groups: [],
  };

  const sources = collectMetadataPdfSources(metadata, [
    {
      fileName: "doc-a.pdf",
      filePath: "raw/fond1/doc-a.pdf",
      signedFilePath: "signed/fond1/doc-a.pdf",
    },
    {
      fileName: "doc-b.pdf",
      filePath: "raw/fond1/doc-b.pdf",
    },
  ]);

  assertEquals(sources.length, 2);

  const signed = sources.find((s) => s.fileName === "doc-a.pdf");
  assertEquals(signed?.preserveSignature, true);
  assertEquals(signed?.downloadKey, "signed/fond1/doc-a.pdf");
  assertEquals(signed?.storageKey, "raw/fond1/doc-a.pdf");

  const unsigned = sources.find((s) => s.fileName === "doc-b.pdf");
  assertEquals(unsigned?.preserveSignature, undefined);
  assertEquals(unsigned?.downloadKey, undefined);
  assertEquals(unsigned?.storageKey, "raw/fond1/doc-b.pdf");
});

Deno.test("collectMetadataPdfSources keeps signed flag when metadata group adds same path", () => {
  const metadata: DossierMetadata = {
    ho_so_id: "HS-002",
    metadata_groups: [
      {
        group_code: "tai_lieu",
        group_name: "Tai lieu",
        fields: [],
        source_document: {
          file_path: "raw/fond1/signed-doc.pdf",
          file_name: "from-metadata.pdf",
        },
      },
    ],
  };

  const sources = collectMetadataPdfSources(metadata, [
    {
      fileName: "signed-doc.pdf",
      filePath: "raw/fond1/signed-doc.pdf",
      signedFilePath: "signed/fond1/signed-doc.pdf",
    },
  ]);

  assertEquals(sources.length, 1);
  assertEquals(sources[0]!.preserveSignature, true);
  assertEquals(sources[0]!.downloadKey, "signed/fond1/signed-doc.pdf");
  assertEquals(sources[0]!.storageKey, "raw/fond1/signed-doc.pdf");
});
