import { isOcrMetadataKey } from "./ocr-path-utils.ts";

const OBJECT_CREATED_EVENTS = new Set([
    "s3:ObjectCreated:Put",
    "s3:ObjectCreated:CompleteMultipartUpload",
    "s3:ObjectCreated:Post",
]);

type S3Record = {
    eventName?: string;
    s3?: {
        bucket?: { name?: string };
        object?: { key?: string };
    };
};

type MinioNotificationPayload = {
    Records?: S3Record[];
};

function decodeObjectKey(key: string): string {
    try {
        return decodeURIComponent(key.replace(/\+/g, " "));
    } catch {
        return key;
    }
}

export function parseMinioObjectCreatedKeys(
    payload: unknown,
    expectedBucket: string,
): string[] {
    if (!payload || typeof payload !== "object") {
        return [];
    }

    const records = (payload as MinioNotificationPayload).Records;
    if (!Array.isArray(records)) {
        return [];
    }

    const keys = new Set<string>();

    for (const record of records) {
        const eventName = record.eventName;
        if (!eventName || !OBJECT_CREATED_EVENTS.has(eventName)) {
            continue;
        }

        const bucket = record.s3?.bucket?.name;
        const rawKey = record.s3?.object?.key;
        if (!rawKey || (bucket && bucket !== expectedBucket)) {
            continue;
        }

        const key = decodeObjectKey(rawKey);
        if (isOcrMetadataKey(key)) {
            keys.add(key);
        }
    }

    return [...keys];
}
