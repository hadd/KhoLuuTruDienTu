import { httpError } from "@shared/common-lib";
import { Buffer } from "node:buffer";
import { env } from "../env.ts";
import { getS3Client } from "./s3.ts";
import { normalizeStorageKey } from "../modules/dossier/dossier-path-utils.ts";

export type ObjectLockMode = "COMPLIANCE" | "GOVERNANCE";

export interface StorageObjectStat {
    exists: boolean;
    size: number;
    lastModified: Date | null;
    etag: string | null;
}

function resolvePrimaryS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

/** Bucket WORM cho AIP (Object Lock). Mặc định: aip-secure-bucket */
export function resolveAipBucket(): string {
    return env.STORAGE_AIP_BUCKET.trim() || "aip-secure-bucket";
}

export function resolveAipPrefix(): string {
    return normalizeStorageKey(env.STORAGE_AIP_PREFIX ?? "aip").replace(/\/+$/, "");
}

export function computeRetentionUntilDate(years = env.STORAGE_AIP_RETENTION_YEARS): Date {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() + years);
    return date;
}

export async function computeSha256(data: Uint8Array): Promise<string> {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function statStorageObject(
    objectKey: string,
    bucket?: string,
): Promise<StorageObjectStat> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const targetBucket = bucket ?? resolvePrimaryS3Bucket();
    const key = normalizeStorageKey(objectKey);

    try {
        const stat = await s3.getMinIOClient().statObject(targetBucket, key);
        return {
            exists: true,
            size: stat.size,
            lastModified: stat.lastModified ?? null,
            etag: stat.etag ?? null,
        };
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") {
            return { exists: false, size: 0, lastModified: null, etag: null };
        }
        throw error;
    }
}

export async function uploadBinaryToStorage(
    objectKey: string,
    data: Uint8Array,
    options: {
        bucket?: string;
        contentType?: string;
        metadata?: Record<string, string>;
    } = {},
): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = options.bucket ?? resolvePrimaryS3Bucket();
    const key = normalizeStorageKey(objectKey);

    await s3.getMinIOClient().putObject(
        bucket,
        key,
        Buffer.from(data),
        data.length,
        {
            "Content-Type": options.contentType ?? "application/octet-stream",
            ...options.metadata,
        },
    );

    return key;
}

export async function uploadBinaryWithObjectLock(
    objectKey: string,
    data: Uint8Array,
    options: {
        bucket?: string;
        contentType?: string;
        mode?: ObjectLockMode;
        retainUntil?: Date;
        metadata?: Record<string, string>;
    } = {},
): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = options.bucket ?? resolveAipBucket();
    const key = normalizeStorageKey(objectKey);
    const mode = options.mode ?? env.STORAGE_AIP_OBJECT_LOCK_MODE;
    const retainUntil = options.retainUntil ?? computeRetentionUntilDate();

    await s3.getMinIOClient().putObject(
        bucket,
        key,
        Buffer.from(data),
        data.length,
        {
            "Content-Type": options.contentType ?? "application/zip",
            "X-Amz-Object-Lock-Mode": mode,
            "X-Amz-Object-Lock-Retain-Until-Date": retainUntil.toISOString(),
            ...options.metadata,
        },
    );

    return key;
}

export async function buildAipPresignedUrl(
    objectKey: string,
    options: { expirySeconds?: number } = {},
): Promise<string | null> {
    const s3 = await getS3Client();
    if (!s3) {
        return null;
    }

    const bucket = resolveAipBucket();
    const key = normalizeStorageKey(objectKey);
    const expiry = options.expirySeconds ?? 86400;

    return await s3.generatePresignedUrl({
        bucket,
        objectName: key,
        method: "GET",
        expiry,
    });
}
