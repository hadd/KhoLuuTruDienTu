import { Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js";

export type ZipEntryInput = {
  name: string;
  data: Uint8Array;
};

export type StreamingZipWriter = {
  /** HTTP response body — consume while `add`/`close` run. */
  readable: ReadableStream<Uint8Array>;
  add(name: string, data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
};

export type OpenStreamingZipOptions = {
  /** AES-256 ZIP password (empty/undefined = plain ZIP). */
  password?: string;
};

/**
 * Incremental ZIP builder that streams compressed bytes as entries are added.
 * Peak RAM ≈ current entry being added (not the full archive).
 */
export function openStreamingZip(
  options: OpenStreamingZipOptions = {},
): StreamingZipWriter {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const password = options.password?.trim() || undefined;
  const zipOptions = password
    ? { password, encryptionStrength: 3 as const }
    : undefined;
  const zipWriter = new ZipWriter(writable, zipOptions);

  let closed = false;

  return {
    readable,
    async add(name: string, data: Uint8Array) {
      if (closed) throw new Error("StreamingZipWriter is already closed");
      await zipWriter.add(
        name,
        new Uint8ArrayReader(data),
        password
          ? { password, encryptionStrength: 3 as const }
          : undefined,
      );
    },
    async close() {
      if (closed) return;
      closed = true;
      await zipWriter.close();
    },
    async abort(reason?: unknown) {
      if (closed) return;
      closed = true;
      try {
        await writable.abort(reason);
      } catch {
        // ignore double-abort
      }
      try {
        await zipWriter.close();
      } catch {
        // ignore close after abort
      }
    },
  };
}

/**
 * Run `build` while exposing `readable` immediately for HTTP streaming.
 * Errors during build abort the stream so the client sees a failed download.
 */
export function streamZipWhileBuilding(
  build: (zip: Omit<StreamingZipWriter, "readable" | "abort">) => Promise<void>,
  options: OpenStreamingZipOptions = {},
): ReadableStream<Uint8Array> {
  const zip = openStreamingZip(options);
  (async () => {
    try {
      await build(zip);
      await zip.close();
    } catch (err) {
      await zip.abort(err);
    }
  })();
  return zip.readable;
}
