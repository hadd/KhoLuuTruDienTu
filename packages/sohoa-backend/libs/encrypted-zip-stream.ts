import type { ZipEntryInput } from "./streaming-zip-writer.ts";
import { streamZipWhileBuilding } from "./streaming-zip-writer.ts";

export type { ZipEntryInput } from "./streaming-zip-writer.ts";

/**
 * Build an AES-encrypted ZIP as a ReadableStream.
 * Streams bytes as each entry is added (no full-archive Blob buffer).
 */
export async function encryptedZipEntriesToReadableStream(
  entries: ZipEntryInput[],
  password: string,
): Promise<ReadableStream<Uint8Array>> {
  const trimmed = password.trim();
  if (!trimmed) {
    throw new Error("ZIP password must not be empty");
  }

  // Collect entries first so callers that mutate buffers after this call
  // still work; then stream them one-by-one into the ZIP.
  const snapshot = entries.map((e) => ({
    name: e.name,
    data: e.data,
  }));

  return streamZipWhileBuilding(
    async (zip) => {
      for (const entry of snapshot) {
        await zip.add(entry.name, entry.data);
        entry.data = new Uint8Array(0);
      }
    },
    { password: trimmed },
  );
}
