import type { ZipPasswordSource } from "../modules/profile/resolve-export-zip-password.ts";
import { formatContentDisposition } from "./content-disposition.utils.ts";

export const ZIP_PASSWORD_SOURCE_HEADER = "X-Zip-Password-Source";

export type ZipStreamResponseOptions = {
  zipPasswordSource?: ZipPasswordSource;
};

/** Build an HTTP Response that streams a ZIP download. */
export function zipStreamResponse(
  stream: ReadableStream<Uint8Array>,
  filename: string,
  contentType = "application/zip",
  options?: ZipStreamResponseOptions,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": formatContentDisposition("attachment", filename),
    // Hint proxies/browsers not to buffer the whole body before download starts.
    "X-Content-Type-Options": "nosniff",
  };

  const source = options?.zipPasswordSource ?? "none";
  headers[ZIP_PASSWORD_SOURCE_HEADER] = source;

  return new Response(stream, { headers });
}
