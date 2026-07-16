import { AppError, httpError } from "@shared/common-lib";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
  normalizeStorageKey,
  toSearchablePdfKey,
} from "../dossier/dossier-path-utils.ts";
export {
  buildCuratedMetadataUpdateKey,
  buildDraftMetadataKey,
  buildEditorMergedMetadataKey,
  buildSummaryMetadataUpdateKey,
  isDraftMetadataKey,
} from "./metadata-storage-keys.ts";

const DEFAULT_EXPIRY_SECONDS = 86400;

function resolveS3Bucket(): string {
  const bucket = env.S3?.bucket;
  if (!bucket) {
    throw httpError.serviceUnavailable("S3 bucket is not configured");
  }
  return bucket;
}

export async function buildLinkGet(
  objectKey: string | null | undefined,
  options: { expirySeconds?: number } = {},
): Promise<string | null> {
  if (!objectKey) {
    return null;
  }

  const s3 = await getS3Client();
  if (!s3) {
    throw httpError.serviceUnavailable("S3 is not configured");
  }

  const bucket = resolveS3Bucket();
  const key = normalizeStorageKey(objectKey);

  return await s3.generatePresignedUrl({
    bucket,
    objectName: key,
    method: "GET",
    expiry: options.expirySeconds ?? DEFAULT_EXPIRY_SECONDS,
  });
}

async function readObjectBodyBytes(
  stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];

  if (Symbol.asyncIterator in stream) {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    }
  } else {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

async function readObjectBody(
  stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>,
): Promise<string> {
  const merged = await readObjectBodyBytes(stream);
  return new TextDecoder().decode(merged);
}

export function resolveMetadataJsonKey(rawKey: string): string {
  return rawKey.endsWith(".json") ? rawKey : `${rawKey}.json`;
}

export async function downloadBinaryFromStorage(
  objectKey: string,
): Promise<Uint8Array> {
  const s3 = await getS3Client();
  if (!s3) {
    throw httpError.serviceUnavailable("S3 is not configured");
  }

  const bucket = resolveS3Bucket();
  const key = normalizeStorageKey(objectKey);

  try {
    const stream = await s3.getMinIOClient().getObject(bucket, key);
    return await readObjectBodyBytes(
      stream as unknown as AsyncIterable<Uint8Array>,
    );
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "NotFound" || code === "NoSuchKey") {
      throw httpError.notFound(`File not found on storage: ${key}`);
    }
    throw error;
  }
}

/**
 * Prefer searchable_pdf/ mirror for export downloads; fall back to the original
 * (usually raw/) key when the searchable object is missing.
 */
export async function downloadExportPdf(
  storageKey: string,
): Promise<Uint8Array> {
  const rawKey = normalizeStorageKey(storageKey);
  const searchableKey = toSearchablePdfKey(rawKey);

  if (searchableKey && searchableKey !== rawKey) {
    try {
      return await downloadBinaryFromStorage(searchableKey);
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 404) {
        throw error;
      }
    }
  }

  return await downloadBinaryFromStorage(rawKey);
}

export async function downloadJsonFromStorage(
  objectKey: string,
): Promise<unknown> {
  const s3 = await getS3Client();
  if (!s3) {
    throw httpError.serviceUnavailable("S3 is not configured");
  }

  const bucket = resolveS3Bucket();
  const key = normalizeStorageKey(objectKey);

  try {
    const stream = await s3.getMinIOClient().getObject(bucket, key);
    const body = await readObjectBody(stream as ReadableStream<Uint8Array>);
    return JSON.parse(body) as unknown;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "NotFound" || code === "NoSuchKey") {
      throw httpError.notFound("Metadata file not found on storage");
    }
    if (error instanceof SyntaxError) {
      throw httpError.badRequest("Metadata file is not valid JSON");
    }
    throw error;
  }
}

export async function uploadJsonToStorage(
  key: string,
  metadata: unknown,
): Promise<string> {
  const s3 = await getS3Client();
  if (!s3) {
    throw httpError.serviceUnavailable("S3 is not configured");
  }

  const bucket = resolveS3Bucket();
  const objectKey = normalizeStorageKey(key);
  const body = JSON.stringify(metadata);

  await s3
    .getMinIOClient()
    .putObject(bucket, objectKey, body, { "Content-Type": "application/json" });

  return objectKey;
}

export async function deleteJsonFromStorage(objectKey: string): Promise<void> {
  const s3 = await getS3Client();
  if (!s3) {
    throw httpError.serviceUnavailable("S3 is not configured");
  }

  const bucket = resolveS3Bucket();
  const key = normalizeStorageKey(objectKey);

  try {
    await s3.deleteFile({ bucket, objectName: key });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "NotFound" || code === "NoSuchKey") {
      return;
    }
    throw error;
  }
}
