import { assertEquals } from "@std/assert";
import { PDFDocument, rgb } from "pdf-lib";
import { applyWatermarkToPdfBytes } from "../libs/watermark/pdf-watermark-applier.ts";

async function makeSamplePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    page.drawText("Hello", { x: 50, y: 500, size: 18, color: rgb(0, 0, 0) });
    const page2 = doc.addPage([400, 600]);
    page2.drawText("Page 2", { x: 50, y: 500, size: 18, color: rgb(0, 0, 0) });
    return await doc.save();
}

Deno.test("applyWatermarkToPdfBytes adds text on all pages", async () => {
    const input = await makeSamplePdf();
    const output = await applyWatermarkToPdfBytes(input, {
        textEnabled: true,
        textContent: "CONFIDENTIAL",
        textOpacity: 20,
        textPosition: "center",
        textSizePercent: 25,
        imageEnabled: false,
        imageOpacity: 20,
        imagePosition: "center",
        imageSizePercent: 30,
        imagePngBytes: null,
    });

    const doc = await PDFDocument.load(output);
    assertEquals(doc.getPageCount(), 2);
    // Watermarked PDF should differ from original
    assertEquals(output.byteLength > input.byteLength, true);
});

Deno.test("applyWatermarkToPdfBytes no-op when disabled", async () => {
    const input = await makeSamplePdf();
    const output = await applyWatermarkToPdfBytes(input, {
        textEnabled: false,
        textContent: null,
        textOpacity: 20,
        textPosition: "center",
        textSizePercent: 25,
        imageEnabled: false,
        imageOpacity: 20,
        imagePosition: "center",
        imageSizePercent: 30,
        imagePngBytes: null,
    });
    assertEquals(output, input);
});
