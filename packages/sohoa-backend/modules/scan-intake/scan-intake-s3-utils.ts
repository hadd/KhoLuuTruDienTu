import { httpError } from "@shared/common-lib";
import { Buffer } from "node:buffer";
import { CopyConditions } from "minio";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import { assertScanDraftKey } from "./scan-intake-path-utils.ts";

export function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

export async function listKeysUnderPrefix(prefix: string): Promise<string[]> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const normalizedPrefix = normalizeStorageKey(prefix);
    const result = await s3.listFiles({
        bucket,
        prefix: normalizedPrefix.endsWith("/") ? normalizedPrefix : `${normalizedPrefix}/`,
        maxKeys: 5000,
    });

    return result.files.map((file) => normalizeStorageKey(file.objectName));
}

export async function copyStorageObject(
    sourceKey: string,
    destKey: string,
): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const src = assertScanDraftKey(sourceKey);
    const dest = assertScanDraftKey(destKey);

    const conditions = new CopyConditions();
    await s3.getMinIOClient().copyObject(
        bucket,
        dest,
        `/${bucket}/${src}`,
        conditions,
    );
    return dest;
}

export async function deleteStorageObject(key: string): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const objectKey = assertScanDraftKey(key);

    try {
        await s3.deleteFile({ bucket, objectName: objectKey });
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") {
            return;
        }
        throw error;
    }
}

export async function deleteKeysUnderPrefix(prefix: string): Promise<number> {
    const keys = await listKeysUnderPrefix(prefix);
    for (const key of keys) {
        await deleteStorageObject(key);
    }
    return keys.length;
}

export async function statStorageObject(key: string): Promise<{ size: number }> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const objectKey = normalizeStorageKey(key);

    try {
        const stat = await s3.getMinIOClient().statObject(bucket, objectKey);
        return { size: stat.size };
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") {
            throw httpError.notFound(`File not found: ${objectKey}`);
        }
        throw error;
    }
}

export async function uploadBinaryToStorage(
    key: string,
    data: Uint8Array,
    contentType: string,
): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const objectKey = normalizeStorageKey(key);

    await s3.getMinIOClient().putObject(
        bucket,
        objectKey,
        Buffer.from(data),
        data.length,
        { "Content-Type": contentType },
    );

    return objectKey;
}

export async function copyToRawPrefix(
    sourceKey: string,
    destKey: string,
    runMode: "auto" | "manual" = "manual",
): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const src = normalizeStorageKey(sourceKey);
    const dest = normalizeStorageKey(destKey);

    if (!dest.startsWith("raw/")) {
        throw httpError.badRequest("Destination must be under raw/");
    }

    const client = s3.getMinIOClient();
    const stat = await client.statObject(bucket, src);
    const stream = await client.getObject(bucket, src);
    await client.putObject(bucket, dest, stream, stat.size, {
        "Content-Type": stat.metaData?.["content-type"] ?? "application/pdf",
        "x-amz-meta-run-mode": runMode,
        "run-mode": runMode,
    });
    return dest;
}
