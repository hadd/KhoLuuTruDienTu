/**
 * List S3/MinIO objects via ListObjectsV2 without minio-js XML transformers.
 *
 * minio@7.1.x parses ListObjects XML with fast-xml-parser defaults
 * (maxTotalExpansions=1000). Each object ETag contributes ~2 entities, so
 * pages with ~500+ keys throw "Entity expansion limit exceeded".
 * This helper issues the same API call but parses XML with a raised limit.
 */

import { Buffer } from "node:buffer";
import { XMLParser } from "fast-xml-parser";
import type { Client as MinioClient } from "minio";

export type ListedObject = {
  name: string;
  size: number;
  lastModified: Date;
  etag: string;
};

type MakeRequestAsyncClient = MinioClient & {
  makeRequestAsync(
    options: { method: string; bucketName: string; query: string },
    payload?: string,
    expectedCodes?: number[],
    region?: string,
  ): Promise<NodeJS.ReadableStream>;
};

const PAGE_SIZE = 1000;

const xmlParser = new XMLParser({
  numberParseOptions: {
    hex: true,
    leadingZeros: true,
    skipLike: /./,
  },
  processEntities: {
    enabled: true,
    maxTotalExpansions: 100_000,
  },
});

function encodeAsHex(c: string): string {
  return `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
}

/** S3-compatible URI escape (matches minio-js uriEscape). */
function uriEscape(uriStr: string): string {
  return encodeURIComponent(uriStr).replace(/[!'()*]/g, encodeAsHex);
}

function sanitizeObjectKey(objectName: string): string {
  const asStrName = (objectName ? objectName.toString() : "").replace(/\+/g, " ");
  return decodeURIComponent(asStrName);
}

function sanitizeETag(etag = ""): string {
  return etag.replace(/^("|&quot;|&#34;|&#x22;|&#x00022;)|("|&quot;|&#34;|&#x22;|&#x00022;)$/g, "");
}

function toArray<T>(param: T | T[] | undefined | null): T[] {
  if (param == null) return [];
  return Array.isArray(param) ? param : [param];
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return asString(value[0]);
  return String(value);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = asString(value).toLowerCase();
  return s === "true" || s === "1";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number.parseInt(asString(value), 10);
  return Number.isFinite(n) ? n : 0;
}

async function readResponseBody(res: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of res as AsyncIterable<Buffer | string | Uint8Array>) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

function buildListQuery(
  prefix: string,
  maxKeys: number,
  continuationToken: string,
): string {
  const keys = Math.min(Math.max(1, maxKeys), PAGE_SIZE);
  const parts = [
    "list-type=2",
    "encoding-type=url",
    `prefix=${uriEscape(prefix)}`,
    "delimiter=",
    `max-keys=${keys}`,
  ];
  if (continuationToken) {
    parts.push(`continuation-token=${uriEscape(continuationToken)}`);
  }
  parts.sort();
  return parts.join("&");
}

type ListPage = {
  objects: ListedObject[];
  isTruncated: boolean;
  nextContinuationToken?: string;
};

function parseListObjectsV2Xml(xml: string): ListPage {
  const parsed = xmlParser.parse(xml);
  const result = parsed?.ListBucketResult;
  if (!result) {
    throw new Error('Missing tag: "ListBucketResult"');
  }

  const objects: ListedObject[] = [];
  for (const content of toArray(result.Contents)) {
    const name = sanitizeObjectKey(asString(content?.Key));
    if (!name) continue;
    objects.push({
      name,
      size: asNumber(content?.Size),
      lastModified: new Date(asString(content?.LastModified)),
      etag: sanitizeETag(asString(content?.ETag)),
    });
  }

  const isTruncated = asBoolean(result.IsTruncated);
  const nextContinuationToken = asString(result.NextContinuationToken) || undefined;

  return { objects, isTruncated, nextContinuationToken };
}

export type ListObjectsParams = {
  bucket: string;
  prefix?: string;
  /** Soft cap on total objects returned across pages (default 1000). */
  maxKeys?: number;
};

/**
 * Recursively list objects under a prefix using ListObjectsV2.
 * Paginates until exhausted or maxKeys is reached.
 */
export async function listObjectsV2Safe(
  client: MinioClient,
  params: ListObjectsParams,
): Promise<{ objects: ListedObject[]; isTruncated: boolean }> {
  const prefix = params.prefix ?? "";
  const maxKeys = params.maxKeys && params.maxKeys > 0 ? params.maxKeys : PAGE_SIZE;
  const reqClient = client as MakeRequestAsyncClient;

  const objects: ListedObject[] = [];
  let continuationToken = "";
  let moreAvailable = false;

  while (objects.length < maxKeys) {
    const pageLimit = Math.min(PAGE_SIZE, maxKeys - objects.length);
    const query = buildListQuery(prefix, pageLimit, continuationToken);
    const response = await reqClient.makeRequestAsync(
      { method: "GET", bucketName: params.bucket, query },
      "",
      [200],
      "",
    );
    const body = await readResponseBody(response);
    const page = parseListObjectsV2Xml(body);

    objects.push(...page.objects);

    if (!page.isTruncated || !page.nextContinuationToken) {
      moreAvailable = false;
      break;
    }

    continuationToken = page.nextContinuationToken;
    moreAvailable = true;

    // Empty page with truncation would loop forever
    if (page.objects.length === 0) break;
  }

  const truncated = objects.length > maxKeys || moreAvailable;
  return {
    objects: objects.slice(0, maxKeys),
    isTruncated: truncated,
  };
}
