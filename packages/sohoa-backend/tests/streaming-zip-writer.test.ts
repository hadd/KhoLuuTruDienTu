import { assertEquals } from "@std/assert";
import {
  ZipReader,
  BlobReader,
  Uint8ArrayWriter,
} from "@zip.js/zip.js";
import {
  openStreamingZip,
  streamZipWhileBuilding,
} from "../libs/streaming-zip-writer.ts";
import { readableStreamToUint8Array } from "../libs/jszip-stream.ts";

async function readZipEntries(
  bytes: Uint8Array,
  password?: string,
): Promise<Array<{ name: string; text?: string; size: number }>> {
  const zr = new ZipReader(
    new BlobReader(new Blob([new Uint8Array(bytes)])),
    password ? { password } : undefined,
  );
  try {
    const entries = await zr.getEntries();
    const out: Array<{ name: string; text?: string; size: number }> = [];
    for (const entry of entries) {
      if (entry.directory) continue;
      const data = await entry.getData!(new Uint8ArrayWriter());
      out.push({
        name: entry.filename,
        text: new TextDecoder().decode(data),
        size: data.byteLength,
      });
    }
    return out;
  } finally {
    await zr.close();
  }
}

// zip.js uses internal timers; disable Deno sanitize for these tests.
const zipTestOpts = { sanitizeOps: false, sanitizeResources: false };

Deno.test(
  "streamZipWhileBuilding produces readable ZIP entries",
  zipTestOpts,
  async () => {
    const stream = streamZipWhileBuilding(async (zip) => {
      await zip.add("a.txt", new TextEncoder().encode("alpha"));
      await zip.add("folder/b.txt", new TextEncoder().encode("beta"));
    });
    const bytes = await readableStreamToUint8Array(stream);
    assertEquals(bytes[0], 0x50);
    assertEquals(bytes[1], 0x4b);

    const entries = await readZipEntries(bytes);
    assertEquals(entries.map((e) => e.name).sort(), ["a.txt", "folder/b.txt"]);
    assertEquals(entries.find((e) => e.name === "a.txt")?.text, "alpha");
    assertEquals(entries.find((e) => e.name === "folder/b.txt")?.text, "beta");
  },
);

Deno.test(
  "streamZipWhileBuilding supports AES password",
  zipTestOpts,
  async () => {
    const password = "secret-pin";
    const stream = streamZipWhileBuilding(
      async (zip) => {
        await zip.add("locked.txt", new TextEncoder().encode("classified"));
      },
      { password },
    );
    const bytes = await readableStreamToUint8Array(stream);
    const entries = await readZipEntries(bytes, password);
    assertEquals(entries.length, 1);
    assertEquals(entries[0]?.name, "locked.txt");
    assertEquals(entries[0]?.text, "classified");
  },
);

Deno.test("openStreamingZip aborts readable on failure", zipTestOpts, async () => {
  const zip = openStreamingZip();
  const readPromise = readableStreamToUint8Array(zip.readable).then(
    () => "ok" as const,
    () => "err" as const,
  );
  await zip.add("x.txt", new TextEncoder().encode("x"));
  await zip.abort(new Error("boom"));
  const result = await readPromise;
  assertEquals(result, "err");
});
