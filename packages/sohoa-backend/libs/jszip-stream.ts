import type JSZip from "jszip";

export type ZipGenerateOptions = {
    /** Prefer streaming compression of each file (lower peak RAM). */
    streamFiles?: boolean;
    compression?: "STORE" | "DEFLATE";
    compressionLevel?: number;
};

/**
 * Generate a ZIP as a ReadableStream of Uint8Array chunks via JSZip's
 * generateInternalStream — avoids holding the full compressed ZIP in one buffer
 * before the HTTP response starts.
 */
export function jszipToReadableStream(
    zip: JSZip,
    options: ZipGenerateOptions = {},
): ReadableStream<Uint8Array> {
    const streamFiles = options.streamFiles ?? true;
    const compression = options.compression ?? "DEFLATE";
    const compressionOptions = {
        level: options.compressionLevel ?? 6,
    };

    return new ReadableStream<Uint8Array>({
        start(controller) {
            const internal = zip.generateInternalStream({
                type: "uint8array",
                streamFiles,
                compression,
                compressionOptions,
            });

            internal
                .on("data", (chunk: Uint8Array) => {
                    controller.enqueue(chunk);
                })
                .on("error", (err: Error) => {
                    controller.error(err);
                })
                .on("end", () => {
                    controller.close();
                })
                .resume();
        },
        cancel() {
            // JSZip stream has no cancel API; GC will collect when refs drop.
        },
    });
}

/** Collect stream into a single Uint8Array (for callers that still need a buffer). */
export async function readableStreamToUint8Array(
    stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            total += value.byteLength;
        }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return merged;
}
