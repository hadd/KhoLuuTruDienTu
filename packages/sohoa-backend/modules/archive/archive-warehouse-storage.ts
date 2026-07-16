import { httpError } from "@shared/common-lib";
import { CopyConditions } from "minio";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";
import { isProtectedArchivalKey } from "../dossier/dossier-delete-utils.ts";

type CopyStorageFn = (sourceKey: string, destKey: string) => Promise<string>;
type DeleteStorageFn = (objectName: string) => Promise<void>;
type StorageObjectExistsFn = (key: string) => Promise<boolean>;
type StatStorageFn = (key: string) => Promise<{ size: number }>;

let copyStorageOverride: CopyStorageFn | null = null;
let deleteStorageOverride: DeleteStorageFn | null = null;
let storageObjectExistsOverride: StorageObjectExistsFn | null = null;
let statStorageOverride: StatStorageFn | null = null;

export function setCopyStorageObjectOverrideForTests(fn: CopyStorageFn | null) {
    copyStorageOverride = fn;
}

export function setDeleteStorageObjectOverrideForTests(fn: DeleteStorageFn | null) {
    deleteStorageOverride = fn;
}

export function setStorageObjectExistsOverrideForTests(fn: StorageObjectExistsFn | null) {
    storageObjectExistsOverride = fn;
}

export function setStatStorageObjectOverrideForTests(fn: StatStorageFn | null) {
    statStorageOverride = fn;
}

function resolveS3Bucket(): string {
    const bucket = env.S3?.bucket;
    if (!bucket) {
        throw httpError.serviceUnavailable("S3 bucket is not configured");
    }
    return bucket;
}

export async function storageObjectExists(key: string): Promise<boolean> {
    if (storageObjectExistsOverride) {
        return storageObjectExistsOverride(key);
    }

    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const objectKey = normalizeStorageKey(key);

    try {
        await s3.getMinIOClient().statObject(bucket, objectKey);
        return true;
    } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "NotFound" || code === "NoSuchKey") {
            return false;
        }
        throw error;
    }
}

export async function copyStorageObject(sourceKey: string, destKey: string): Promise<string> {
    if (copyStorageOverride) {
        return copyStorageOverride(sourceKey, destKey);
    }

    const s3 = await getS3Client();
    if (!s3) {
        throw httpError.serviceUnavailable("S3 is not configured");
    }

    const bucket = resolveS3Bucket();
    const src = normalizeStorageKey(sourceKey);
    const dest = normalizeStorageKey(destKey);
    if (isProtectedArchivalKey(dest)) {
        throw httpError.badRequest("Không thể ghi đè object trong AIP");
    }

    const conditions = new CopyConditions();
    await s3.getMinIOClient().copyObject(
        bucket,
        dest,
        `/${bucket}/${src}`,
        conditions,
    );
    return dest;
}

export async function deleteStorageObjectQuiet(objectName: string): Promise<void> {
    if (deleteStorageOverride) {
        await deleteStorageOverride(objectName);
        return;
    }

    const key = normalizeStorageKey(objectName);
    if (!key || isProtectedArchivalKey(key)) return;

    const s3 = await getS3Client();
    if (!s3) return;

    const bucket = resolveS3Bucket();
    try {
        await s3.deleteFile({ bucket, objectName: key });
    } catch (error) {
        console.warn("[Warehouse] Failed to delete storage object:", key, error);
    }
}

export async function statWarehouseStorageObject(key: string): Promise<{ size: number }> {
    if (statStorageOverride) {
        return statStorageOverride(key);
    }

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
