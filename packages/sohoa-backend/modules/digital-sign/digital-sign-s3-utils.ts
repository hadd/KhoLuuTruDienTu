import { httpError } from "@shared/common-lib";
import { Buffer } from "node:buffer";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import { downloadBinaryFromStorage } from "../data-entry/data-entry-s3-utils.ts";

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

export async function downloadPdfFromStorage(objectKey: string): Promise<Uint8Array> {
    return await downloadBinaryFromStorage(objectKey);
}

export async function uploadSignedPdfToStorage(
    objectKey: string,
    pdfBytes: Uint8Array,
): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const key = normalizeStorageKey(objectKey);

    await s3.getMinIOClient().putObject(
        bucket,
        key,
        Buffer.from(pdfBytes),
        pdfBytes.length,
        { "Content-Type": "application/pdf" },
    );
}

export async function readSignedPdfFromStorage(objectKey: string): Promise<Uint8Array> {
    return await downloadBinaryFromStorage(objectKey);
}
