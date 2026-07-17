import { BlobWriter, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";

export type ZipEntryInput = {
  name: string;
  data: Uint8Array;
};

/**
 * Build an AES-encrypted ZIP as a ReadableStream.
 * Used when watermark export has a fond zip password.
 * Buffers the full ZIP (zip.js closes to a Blob) — acceptable for password path.
 */
export async function encryptedZipEntriesToReadableStream(
  entries: ZipEntryInput[],
  password: string,
): Promise<ReadableStream<Uint8Array>> {
  const trimmed = password.trim();
  if (!trimmed) {
    throw new Error("ZIP password must not be empty");
  }

  const writer = new ZipWriter(new BlobWriter("application/zip"), {
    password: trimmed,
    encryptionStrength: 3, // AES-256
    bufferedWrite: true,
  });

  try {
    for (const entry of entries) {
      await writer.add(entry.name, new Uint8ArrayReader(entry.data), {
        password: trimmed,
        encryptionStrength: 3,
      });
    }
    const blob = await writer.close();
    return blob.stream();
  } catch (err) {
    try {
      await writer.close();
    } catch {
      // ignore close after failure
    }
    throw err;
  }
}
