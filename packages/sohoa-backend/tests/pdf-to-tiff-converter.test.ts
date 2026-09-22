import { assertEquals, assertGreater } from "@std/assert";
import { PDFDocument } from "pdf-lib";
import {
  convertBatchPdfToTiff,
  convertPdfToTiff,
  toTiffFileName,
} from "../libs/pdf-tiff/pdf-to-tiff-converter.ts";

async function makeSamplePdf(pageCount = 1): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.addPage([200, 200]);
    page.drawText(`P${i + 1}`, { x: 40, y: 100, size: 18 });
  }
  return await pdf.save();
}

Deno.test("toTiffFileName replaces pdf extension with TIFF", () => {
  assertEquals(toTiffFileName("1.PDF"), "1.TIFF");
  assertEquals(toTiffFileName("doc.pdf"), "doc.TIFF");
  assertEquals(toTiffFileName("noext"), "noext.TIFF");
});

Deno.test("convertPdfToTiff produces multipage little-endian TIFF", async () => {
  const pdfBytes = await makeSamplePdf(2);
  const tiff = await convertPdfToTiff(pdfBytes, { dpi: 72, jpegQuality: 70 });

  assertGreater(tiff.length, 100);
  assertEquals(tiff[0], 0x49);
  assertEquals(tiff[1], 0x49);
  assertEquals(tiff[2], 42);
  assertEquals(tiff[3], 0);
});

Deno.test("convertBatchPdfToTiff keeps parallel names and order", async () => {
  const a = await makeSamplePdf(1);
  const b = await makeSamplePdf(1);
  const out = await convertBatchPdfToTiff(
    [
      { fileName: "a.pdf", data: a },
      { fileName: "b.PDF", data: b },
    ],
    { dpi: 72, jpegQuality: 70 },
  );

  assertEquals(out.length, 2);
  assertEquals(out[0]?.fileName, "a.TIFF");
  assertEquals(out[1]?.fileName, "b.TIFF");
  assertGreater(out[0]!.data.length, 100);
  assertGreater(out[1]!.data.length, 100);
});
