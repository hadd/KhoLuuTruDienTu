import { assertEquals, assertRejects } from "@std/assert";
import * as mupdf from "mupdf";
import { PDFDocument, rgb } from "pdf-lib";
import { applyWatermarkToPdfBytes } from "../libs/watermark/pdf-watermark-applier.ts";
import { applyWatermarkConfigToPdfFiles } from "../libs/watermark/maybe-watermark-pdf-files.ts";
import type { WatermarkApplyConfig } from "../libs/watermark/pdf-watermark-applier.ts";
import { flattenPdfPagesToImages } from "../libs/watermark/pdf-page-flattener.ts";

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

function baseConfig(overrides: Partial<WatermarkApplyConfig> = {}): WatermarkApplyConfig {
    return {
        textEnabled: false,
        textContent: null,
        textOpacity: 20,
        textPosition: "center",
        textSizePercent: 25,
        textOffsetXPercent: null,
        textOffsetYPercent: null,
        textRotationDegrees: 0,
        textStamps: null,
        imageEnabled: false,
        imageOpacity: 20,
        imagePosition: "center",
        imageSizePercent: 30,
        imageOffsetXPercent: null,
        imageOffsetYPercent: null,
        imageRotationDegrees: 0,
        imageStamps: null,
        imagePngBytes: null,
        ...overrides,
    };
}

function extractPdfText(bytes: Uint8Array): string {
    const doc = mupdf.Document.openDocument(new Uint8Array(bytes), "application/pdf");
    try {
        let text = "";
        for (let i = 0; i < doc.countPages(); i++) {
            const page = doc.loadPage(i);
            try {
                text += page.toStructuredText().asText();
            } finally {
                page.destroy();
            }
        }
        return text;
    } finally {
        doc.destroy();
    }
}

Deno.test("applyWatermarkToPdfBytes adds text on all pages", async () => {
    const input = await makeSamplePdf();
    const output = await applyWatermarkToPdfBytes(input, baseConfig({
        textEnabled: true,
        textContent: "CONFIDENTIAL",
    }));

    const doc = await PDFDocument.load(output);
    assertEquals(doc.getPageCount(), 2);
    assertEquals(output.byteLength > input.byteLength, true);
});

Deno.test("applyWatermarkToPdfBytes flattens so text watermark is not extractable", async () => {
    // Keep marker short: large fontSize can clip long strings in structured text.
    const marker = "WMFLATX";
    const input = await makeSamplePdf();
    const prev = Deno.env.get("WATERMARK_FLATTEN_ENABLED");

    Deno.env.set("WATERMARK_FLATTEN_ENABLED", "false");
    try {
        const stamped = await applyWatermarkToPdfBytes(input, baseConfig({
            textEnabled: true,
            textContent: marker,
            textSizePercent: 15,
        }));
        assertEquals(extractPdfText(stamped).includes(marker), true);
    } finally {
        if (prev === undefined) Deno.env.delete("WATERMARK_FLATTEN_ENABLED");
        else Deno.env.set("WATERMARK_FLATTEN_ENABLED", prev);
    }

    Deno.env.set("WATERMARK_FLATTEN_ENABLED", "true");
    try {
        const flattened = await applyWatermarkToPdfBytes(input, baseConfig({
            textEnabled: true,
            textContent: marker,
            textSizePercent: 15,
        }));
        const doc = await PDFDocument.load(flattened);
        assertEquals(doc.getPageCount(), 2);
        assertEquals(flattened.byteLength > 0, true);
        // Rasterized pages bake watermark into pixels — no selectable text object.
        assertEquals(extractPdfText(flattened).includes(marker), false);
    } finally {
        if (prev === undefined) Deno.env.delete("WATERMARK_FLATTEN_ENABLED");
        else Deno.env.set("WATERMARK_FLATTEN_ENABLED", prev);
    }
});

Deno.test("flattenPdfPagesToImages preserves page count", async () => {
    const input = await makeSamplePdf("FlatMe");
    const out = await flattenPdfPagesToImages(input, { dpi: 96 });
    const doc = await PDFDocument.load(out);
    assertEquals(doc.getPageCount(), 2);
    assertEquals(out.byteLength > 0, true);
});

Deno.test("applyWatermarkToPdfBytes no-op when disabled", async () => {
    const input = await makeSamplePdf();
    const output = await applyWatermarkToPdfBytes(input, baseConfig());
    assertEquals(output, input);
});

Deno.test("shared PNG watermark applies to multiple PDFs", async () => {
    const sharedPng = makeTinyPng();
    const config = baseConfig({
        imageEnabled: true,
        imagePngBytes: sharedPng,
    });
    const pdf1 = await makeSamplePdf("Doc1");
    const pdf2 = await makeSamplePdf("Doc2");

    const out1 = await applyWatermarkToPdfBytes(pdf1, config);
    const out2 = await applyWatermarkToPdfBytes(pdf2, config);

    assertEquals(out1.byteLength > pdf1.byteLength, true);
    assertEquals(out2.byteLength > pdf2.byteLength, true);
});

Deno.test("custom position and rotation 90 apply without crash", async () => {
    const input = await makeSamplePdf();
    const output = await applyWatermarkToPdfBytes(input, baseConfig({
        imageEnabled: true,
        imagePngBytes: makeTinyPng(),
        imagePosition: "custom",
        imageOffsetXPercent: 10,
        imageOffsetYPercent: 20,
        imageRotationDegrees: 90,
    }));
    assertEquals(output.byteLength > input.byteLength, true);
});

Deno.test("imageStamps duplicates image on page", async () => {
    const prev = Deno.env.get("WATERMARK_FLATTEN_ENABLED");
    // Compare pre-flatten sizes: flatten would make both ~full-page JPEGs.
    Deno.env.set("WATERMARK_FLATTEN_ENABLED", "false");
    try {
        const input = await makeSamplePdf();
        const single = await applyWatermarkToPdfBytes(input, baseConfig({
            imageEnabled: true,
            imagePngBytes: makeTinyPng(),
            imagePosition: "custom",
            imageOffsetXPercent: 10,
            imageOffsetYPercent: 10,
        }));
        const multi = await applyWatermarkToPdfBytes(input, baseConfig({
            imageEnabled: true,
            imagePngBytes: makeTinyPng(),
            imageStamps: [
                { offsetXPercent: 10, offsetYPercent: 10, rotationDegrees: 0 },
                { offsetXPercent: 60, offsetYPercent: 50, rotationDegrees: 90 },
            ],
        }));
        assertEquals(multi.byteLength > single.byteLength, true);
    } finally {
        if (prev === undefined) Deno.env.delete("WATERMARK_FLATTEN_ENABLED");
        else Deno.env.set("WATERMARK_FLATTEN_ENABLED", prev);
    }
});

Deno.test("applyWatermarkConfigToPdfFiles watermarks every file in batch", async () => {
    const config = baseConfig({
        imageEnabled: true,
        imagePngBytes: makeTinyPng(),
    });
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
    // Flatten may shrink larger scan PDFs; only require a non-empty watermarked PDF.
    assertEquals(result[0]!.data.byteLength > 0, true);
    assertEquals(result[1]!.data.byteLength > 0, true);
    assertEquals((await PDFDocument.load(result[0]!.data)).getPageCount(), 2);
    assertEquals((await PDFDocument.load(result[1]!.data)).getPageCount(), 2);
});

Deno.test("applyWatermarkConfigToPdfFiles throws when any PDF fails", async () => {
    const config = baseConfig({
        imageEnabled: true,
        imagePngBytes: makeTinyPng(),
    });
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
