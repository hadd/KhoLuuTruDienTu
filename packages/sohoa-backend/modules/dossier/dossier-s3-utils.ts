import { httpError } from "@shared/common-lib";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { normalizeStorageKey } from "./dossier-path-utils.ts";

const DEFAULT_EXPIRY_SECONDS = 86400;

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

export async function buildFileFullPath(
    filePath: string | null | undefined,
    options: { expirySeconds?: number } = {},
): Promise<string | null> {
    if (!filePath) {
        return null;
    }

    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const key = normalizeStorageKey(filePath);

    return await s3.generatePresignedUrl({
        bucket,
        objectName: key,
        method: "GET",
        expiry: options.expirySeconds ?? DEFAULT_EXPIRY_SECONDS,
    });
}
