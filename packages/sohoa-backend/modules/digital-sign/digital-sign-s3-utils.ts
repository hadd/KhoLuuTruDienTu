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

export interface PreparedSignMeta {
    fileId: string;
    authAttrsDerBase64: string;
    contentsOffset: number;
    contentsLength: number;
    byteRange: [number, number, number, number];
    hashBase64: string;
}

function preparedPdfKey(fileId: string): string {
    return `prepared/${fileId}/document.pdf`;
}

function preparedMetaKey(fileId: string): string {
    return `prepared/${fileId}/meta.json`;
}

export async function uploadPreparedSigningArtifacts(
    fileId: string,
    preparedPdf: Uint8Array,
    meta: PreparedSignMeta,
): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }
    const bucket = resolveS3Bucket();
    const client = s3.getMinIOClient();
    const metaJson = new TextEncoder().encode(JSON.stringify(meta));

    await client.putObject(
        bucket,
        preparedPdfKey(fileId),
        Buffer.from(preparedPdf),
        preparedPdf.length,
        { "Content-Type": "application/pdf" },
    );
    await client.putObject(
        bucket,
        preparedMetaKey(fileId),
        Buffer.from(metaJson),
        metaJson.length,
        { "Content-Type": "application/json" },
    );
}

export async function readPreparedSigningArtifacts(
    fileId: string,
): Promise<{ preparedPdf: Uint8Array; meta: PreparedSignMeta }> {
    const preparedPdf = await downloadBinaryFromStorage(preparedPdfKey(fileId));
    const metaBytes = await downloadBinaryFromStorage(preparedMetaKey(fileId));
    const meta = JSON.parse(new TextDecoder().decode(metaBytes)) as PreparedSignMeta;
    return { preparedPdf, meta };
}

export async function deletePreparedSigningArtifacts(fileId: string): Promise<void> {
    const s3 = await getS3Client();
    if (!s3) return;
    const bucket = resolveS3Bucket();
    const client = s3.getMinIOClient();
    try {
        await client.removeObject(bucket, preparedPdfKey(fileId));
        await client.removeObject(bucket, preparedMetaKey(fileId));
    } catch {
        // best-effort cleanup
    }
}
