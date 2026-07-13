
import { assertEquals, assertRejects } from "@std/assert";
import { PDFDocument, rgb } from "pdf-lib";
import { applyWatermarkToPdfBytes } from "../libs/watermark/pdf-watermark-applier.ts";
import { applyWatermarkConfigToPdfFiles } from "../libs/watermark/maybe-watermark-pdf-files.ts";
import type { WatermarkApplyConfig } from "../libs/watermark/pdf-watermark-applier.ts";

async function makeSamplePdf(label = "Hello"): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    page.drawText(label, { x: 50, y: 500, size: 18, color: rgb(0, 0, 0) });
    const page2 = doc.addPage([400, 600]);
    page2.drawText(`${label} Page 2`, { x: 50, y: 500, size: 18, color: rgb(0, 0, 0) });
    return await doc.save();
}

/** Minimal valid 1x1 red PNG */
function makeTinyPng(): Uint8Array {
    return Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
        0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
}

function imageConfig(imagePngBytes: Uint8Array): WatermarkApplyConfig {
    return {
        textEnabled: false,
        textContent: null,
        textOpacity: 20,
        textPosition: "center",
        textSizePercent: 25,
        imageEnabled: true,
        imageOpacity: 20,
        imagePosition: "center",
        imageSizePercent: 30,
        imagePngBytes,
    };
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

Deno.test("shared PNG watermark applies to multiple PDFs", async () => {
    const sharedPng = makeTinyPng();
    const config = imageConfig(sharedPng);
    const pdf1 = await makeSamplePdf("Doc1");
    const pdf2 = await makeSamplePdf("Doc2");

    const out1 = await applyWatermarkToPdfBytes(pdf1, config);
    const out2 = await applyWatermarkToPdfBytes(pdf2, config);

    assertEquals(out1.byteLength > pdf1.byteLength, true);
    assertEquals(out2.byteLength > pdf2.byteLength, true);
    assertEquals((await PDFDocument.load(out1)).getPageCount(), 2);
    assertEquals((await PDFDocument.load(out2)).getPageCount(), 2);
});

Deno.test("applyWatermarkConfigToPdfFiles watermarks every file in batch", async () => {
    const sharedPng = makeTinyPng();
    const config = imageConfig(sharedPng);
    const pdf1 = await makeSamplePdf("A");
    const pdf2 = await makeSamplePdf("B");

    const result = await applyWatermarkConfigToPdfFiles(
        [
            { fileName: "a.pdf", data: pdf1 },
            { fileName: "b.pdf", data: pdf2 },
        ],
        config,
    );

    assertEquals(result.length, 2);
    assertEquals(result[0]!.data.byteLength > pdf1.byteLength, true);
    assertEquals(result[1]!.data.byteLength > pdf2.byteLength, true);
});

Deno.test("applyWatermarkConfigToPdfFiles throws when any PDF fails", async () => {
    const sharedPng = makeTinyPng();
    const config = imageConfig(sharedPng);
    const goodPdf = await makeSamplePdf("Good");

    const error = await assertRejects(
        () =>
            applyWatermarkConfigToPdfFiles(
                [
                    { fileName: "good.pdf", data: goodPdf },
                    { fileName: "bad.pdf", data: new Uint8Array([0, 1, 2, 3, 4]) },
                ],
                config,
            ),
    );

    assertEquals(error instanceof Error, true);
    assertEquals(String((error as Error).message).includes("bad.pdf"), true);
});
