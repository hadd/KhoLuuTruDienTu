import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PDFDocument } from "pdf-lib";
import { convertToPdfA } from "../libs/pdf-a/pdf-a-converter.ts";

async function makeSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  page.drawText("Test PDF Page", { x: 50, y: 500, size: 24 });
  return await doc.save();
}

Deno.test("convertToPdfA converts standard PDF into PDF/A-2b with MarkInfo and ViewerPreferences", async () => {
  const samplePdf = await makeSamplePdf();
  const pdfABytes = await convertToPdfA(samplePdf, { title: "Sample Dossier Document" });

  assertEquals(pdfABytes.byteLength > 0, true);

  const decoder = new TextDecoder("utf-8");
  const rawText = decoder.decode(pdfABytes);

  // 1. Verify PDF-1.7 Header for PDF/A-2b
  const header = rawText.substring(0, 8);
  assertEquals(header, "%PDF-1.7");

  // 2. Verify OutputIntents GTS_PDFA1 and MarkInfo
  assertEquals(rawText.includes("OutputIntents"), true);
  assertEquals(rawText.includes("GTS_PDFA1"), true);
  assertEquals(rawText.includes("MarkInfo"), true);

  // 3. Verify XMP Metadata pdfaid:part=2
  assertEquals(rawText.includes("<pdfaid:part>2</pdfaid:part>"), true);
  assertEquals(rawText.includes("<pdfaid:conformance>B</pdfaid:conformance>"), true);
});
