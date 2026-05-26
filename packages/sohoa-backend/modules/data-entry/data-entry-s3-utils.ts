import { httpError } from "@shared/common-lib";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import type { WorkerRole } from "../../db/schemas/workflow-constants.ts";

const DEFAULT_EXPIRY_SECONDS = 86400;

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

export function buildWorkerMetadataKey(ocrMetadataKey: string, role: WorkerRole): string {
    const withoutExt = ocrMetadataKey.replace(/\.json$/i, "");
    return `${withoutExt}_${role}.json`;
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

export async function uploadJsonToStorage(key: string, metadata: unknown): Promise<string> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const objectKey = normalizeStorageKey(key);
    const body = JSON.stringify(metadata);

    await s3.getMinIOClient().putObject(
        bucket,
        objectKey,
        body,
        { "Content-Type": "application/json" },
    );

    return objectKey;
}
