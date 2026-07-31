import { Buffer } from "node:buffer";
import { gunzipSync, gzipSync } from "node:zlib";
import { computeSha256, uploadBinaryToStorage } from "../../libs/archival-storage.ts";
import { downloadBinaryFromStorage } from "../data-entry/data-entry-s3-utils.ts";
import type { ApiAuditLog } from "../../db/schemas/api-audit-log.ts";
import type { AuditLogExportRecord } from "./audit-log-export.ts";

export type ShardRecord = AuditLogExportRecord;

export function buildShardObjectKey(windowStart: Date, seq: number): string {
    const windowPart = windowStart.toISOString().replace(/[:.]/g, "-").slice(0, 10);
    return `audit-archives/${windowPart}/shard-${String(seq).padStart(4, "0")}.jsonl.gz`;
}

export function serializeRecordsToJsonl(records: ShardRecord[]): Uint8Array {
    const lines = records.map((record) => JSON.stringify(record));
    return new TextEncoder().encode(lines.join("\n") + (lines.length ? "\n" : ""));
}

export function compressJsonl(jsonl: Uint8Array): Uint8Array {
    return new Uint8Array(gzipSync(jsonl));
}

export function decompressJsonlGz(compressed: Uint8Array): string {
    return gunzipSync(Buffer.from(compressed)).toString("utf8");
}

export function parseJsonlRecords(text: string): ShardRecord[] {
    const records: ShardRecord[] = [];
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        records.push(JSON.parse(trimmed) as ShardRecord);
    }
    return records;
}

export async function uploadShardJsonlGz(
    objectKey: string,
    records: ShardRecord[],
): Promise<{
    objectKey: string;
    uncompressedBytes: number;
    compressedBytes: number;
    checksum: string;
}> {
    const jsonl = serializeRecordsToJsonl(records);
    const compressed = compressJsonl(jsonl);
    const checksum = await computeSha256(compressed);
    const key = await uploadBinaryToStorage(objectKey, compressed, {
        contentType: "application/gzip",
    });
    return {
        objectKey: key,
        uncompressedBytes: jsonl.byteLength,
        compressedBytes: compressed.byteLength,
        checksum,
    };
}

export async function downloadAndParseShard(objectKey: string): Promise<ShardRecord[]> {
    const compressed = await downloadBinaryFromStorage(objectKey);
    const text = decompressJsonlGz(compressed);
    return parseJsonlRecords(text);
}

export async function findRecordInShard(
    objectKey: string,
    id: string,
): Promise<ShardRecord | null> {
    const records = await downloadAndParseShard(objectKey);
    return records.find((record) => record.id === id) ?? null;
}

export function toProjectionRow(
    record: ApiAuditLog | ShardRecord,
    shardId: string,
) {
    return {
        id: record.id,
        shardId,
        createdAt: record.createdAt instanceof Date
            ? record.createdAt
            : new Date(record.createdAt as string),
        userId: record.userId,
        userRole: record.userRole,
        method: record.method,
        path: record.path,
        action: record.action,
        module: record.module,
        eventType: record.eventType,
        entityType: record.entityType,
        entityId: record.entityId,
        entityLabel: record.entityLabel,
        summary: record.summary,
        statusCode: record.statusCode,
        viewCount: "viewCount" in record && typeof record.viewCount === "number"
            ? record.viewCount
            : 1,
    };
}
