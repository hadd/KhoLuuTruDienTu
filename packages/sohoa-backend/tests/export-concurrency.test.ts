import { assertEquals } from "@std/assert";
import { assertExportFileLimit, MAX_EXPORT_FILES } from "../libs/export-file-limit.ts";
import { mapInBatches, mapWithConcurrency } from "../libs/export-concurrency.ts";
import JSZip from "jszip";
import { jszipToReadableStream, readableStreamToUint8Array } from "../libs/jszip-stream.ts";

Deno.test("assertExportFileLimit allows up to MAX_EXPORT_FILES", () => {
    assertExportFileLimit(MAX_EXPORT_FILES);
    assertExportFileLimit(0);
});

Deno.test("assertExportFileLimit rejects over limit", () => {
    let thrown: unknown;
    try {
        assertExportFileLimit(MAX_EXPORT_FILES + 1);
    } catch (err) {
        thrown = err;
    }
    assertEquals(thrown instanceof Error, true);
    assertEquals(String((thrown as Error).message).includes(String(MAX_EXPORT_FILES)), true);
});

Deno.test("mapWithConcurrency preserves order", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
        await new Promise((r) => setTimeout(r, 5 - n));
        return n * 10;
    });
    assertEquals(results, [10, 20, 30, 40, 50]);
});

Deno.test("mapInBatches processes sequential batches", async () => {
    const seen: number[][] = [];
    const results = await mapInBatches([1, 2, 3, 4, 5], 2, async (n, index) => {
        const batchIndex = Math.floor(index / 2);
        if (!seen[batchIndex]) seen[batchIndex] = [];
        seen[batchIndex]!.push(n);
        return n;
    });
    assertEquals(results, [1, 2, 3, 4, 5]);
    assertEquals(seen.length >= 2, true);
});

Deno.test("jszipToReadableStream produces valid zip bytes", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "hello world");
    const stream = jszipToReadableStream(zip);
    const bytes = await readableStreamToUint8Array(stream);
    assertEquals(bytes.byteLength > 0, true);
    // ZIP local file header magic
    assertEquals(bytes[0], 0x50);
    assertEquals(bytes[1], 0x4b);
});
