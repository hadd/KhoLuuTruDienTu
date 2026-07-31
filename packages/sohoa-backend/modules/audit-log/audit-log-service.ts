import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    apiAuditLogs,
    apiAuditLogEntitySchema,
    type ApiAuditLog,
} from "../../db/schemas/api-audit-log.ts";
import { auditLogArchiveProjections } from "../../db/schemas/audit-log-archive-projection.ts";
import { auditLogArchiveShards } from "../../db/schemas/audit-log-archive-shard.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { env } from "../../env.ts";
import { enrichAuditLogRecords } from "./audit-entity-resolver.ts";
import {
    buildShardObjectKey,
    toProjectionRow,
    uploadShardJsonlGz,
    type ShardRecord,
} from "./audit-log-archive-io.ts";
import { getAuditLogFilterOptions } from "./audit-log-filter-catalog.ts";
import {
    acquirePurgeLease,
    getPurgeState,
    markSettingsLastPurge,
    releasePurgeLease,
    setPurgeCursorUntil,
} from "./audit-log-purge-state.ts";
import {
    exportUnified,
    getUnifiedById,
    listUnified,
    type AuditLogListQuery,
} from "./audit-log-unified-query.ts";

const PURGE_BATCH_SIZE = 10_000;
const MAX_PURGE_ITERATIONS = 200;

function startOfUtcDay(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function addDaysUtc(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

async function getOldestCreatedAt(): Promise<Date | null> {
    const [row] = await db.select({ createdAt: apiAuditLogs.createdAt })
        .from(apiAuditLogs).orderBy(asc(apiAuditLogs.createdAt)).limit(1);
    return row?.createdAt ?? null;
}

async function fetchBatchInWindow(
    windowStart: Date,
    windowEnd: Date,
    batchSize: number,
): Promise<ApiAuditLog[]> {
    // postgres.js prepared binds reject raw Date; use ISO strings.
    const startIso = windowStart.toISOString();
    const endIso = windowEnd.toISOString();
    return await db.select().from(apiAuditLogs)
        .where(and(
            gte(apiAuditLogs.createdAt, startIso),
            lt(apiAuditLogs.createdAt, endIso),
        ))
        .orderBy(asc(apiAuditLogs.createdAt))
        .limit(batchSize);
}

const crud = createCrudService({
    db,
    table: apiAuditLogs,
    searchable: ["path", "action", "method", "summary", "module", "eventType"],
    entitySchema: apiAuditLogEntitySchema,
    relationTables: {
        user: userProfiles,
    },
    relationForeignKeys: {
        user: apiAuditLogs.userId,
    },
    defaultWith: {
        user: true,
    },
    metadata: {
        tags: ["Admin", "Audit Log"],
        descriptions: {
            list: "List system audit logs with pagination and filters.",
            get: "Get a system audit log by ID.",
        },
    },
});

async function nextShardSeq(windowStart: Date): Promise<number> {
    const windowEnd = addDaysUtc(windowStart, env.AUDIT_LOG_RETENTION_DAYS);
    const [row] = await db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(auditLogArchiveShards)
        .where(and(
            eq(auditLogArchiveShards.windowStart, windowStart),
            eq(auditLogArchiveShards.windowEnd, windowEnd),
        ));
    return (row?.count ?? 0) + 1;
}

async function archiveShardAndDelete(
    records: ApiAuditLog[],
    windowStart: Date,
    windowEnd: Date,
): Promise<number> {
    if (records.length === 0) return 0;

    const enriched = await enrichAuditLogRecords(records);
    const shardRecords = enriched as ShardRecord[];
    const seq = await nextShardSeq(windowStart);
    const objectKey = buildShardObjectKey(windowStart, seq);
    const minCreatedAt = records[0]?.createdAt ?? windowStart;
    const maxCreatedAt = records[records.length - 1]?.createdAt ?? windowEnd;

    const [shardRow] = await db.insert(auditLogArchiveShards).values({
        objectKey,
        windowStart,
        windowEnd,
        minCreatedAt,
        maxCreatedAt,
        recordCount: records.length,
        status: "writing",
    }).returning();

    try {
        const uploaded = await uploadShardJsonlGz(objectKey, shardRecords);
        await db.update(auditLogArchiveShards).set({
            objectKey: uploaded.objectKey,
            uncompressedBytes: uploaded.uncompressedBytes,
            compressedBytes: uploaded.compressedBytes,
            checksum: uploaded.checksum,
            status: "ready",
            error: null,
        }).where(eq(auditLogArchiveShards.id, shardRow.id));

        await db.insert(auditLogArchiveProjections).values(
            records.map((record) => toProjectionRow(record, shardRow.id)),
        );

        const ids = records.map((record) => record.id);
        const deleted = await db.delete(apiAuditLogs)
            .where(inArray(apiAuditLogs.id, ids))
            .returning({ id: apiAuditLogs.id });
        return deleted.length;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.update(auditLogArchiveShards).set({
            status: "failed",
            error: message,
        }).where(eq(auditLogArchiveShards.id, shardRow.id));
        throw httpError.serviceUnavailable(
            `Failed to archive audit logs before purge: ${message}`,
        );
    }
}

async function takeShardSizedBatch(
    windowStart: Date,
    windowEnd: Date,
): Promise<ApiAuditLog[]> {
    const candidates = await fetchBatchInWindow(
        windowStart,
        windowEnd,
        Math.min(PURGE_BATCH_SIZE, env.AUDIT_LOG_SHARD_MAX_RECORDS),
    );
    if (candidates.length === 0) return [];

    const selected: ApiAuditLog[] = [];
    let uncompressed = 0;
    const encoder = new TextEncoder();

    for (const record of candidates) {
        const lineBytes = encoder.encode(JSON.stringify(record) + "\n").byteLength;
        if (
            selected.length > 0 &&
            (
                selected.length >= env.AUDIT_LOG_SHARD_MAX_RECORDS ||
                uncompressed + lineBytes > env.AUDIT_LOG_SHARD_MAX_UNCOMPRESSED_BYTES
            )
        ) {
            break;
        }
        selected.push(record);
        uncompressed += lineBytes;
    }

    return selected;
}

export const AuditLogService = {
    ...crud,

    async get(id: string) {
        return await getUnifiedById(id);
    },

    async listFiltered(query: AuditLogListQuery) {
        return await listUnified(query);
    },

    async deleteById(id: string) {
        const [deleted] = await db.delete(apiAuditLogs).where(eq(apiAuditLogs.id, id)).returning();
        if (!deleted) {
            throw httpError.notFound("Audit log not found");
        }
        return deleted;
    },

    async deleteBulk(input: { ids?: string[]; query?: AuditLogListQuery }) {
        if (input.ids?.length) {
            const deleted = await db.delete(apiAuditLogs)
                .where(inArray(apiAuditLogs.id, input.ids))
                .returning();
            return { deletedCount: deleted.length };
        }
        if (input.query) {
            const { buildLiveConditions } = await import("./audit-log-unified-query.ts");
            const where = buildLiveConditions(input.query);
            if (!where) {
                throw httpError.badRequest("Filter is required for bulk delete");
            }
            const deleted = await db.delete(apiAuditLogs).where(where).returning();
            return { deletedCount: deleted.length };
        }
        throw httpError.badRequest("ids or query filter is required");
    },

    async exportRecords(query: AuditLogListQuery, format: "json" | "xlsx") {
        return await exportUnified(query, format);
    },

    async purgeExpired(options?: { dryRun?: boolean }) {
        if (!env.AUDIT_LOG_PURGE_ENABLED && !options?.dryRun) {
            return { skipped: true, reason: "purge_disabled" as const };
        }

        const retentionDays = env.AUDIT_LOG_RETENTION_DAYS;
        const owner = `purge-${crypto.randomUUID()}`;
        const lease = await acquirePurgeLease(owner);
        if (!lease.acquired && !options?.dryRun) {
            return { skipped: true, reason: "lease_held" as const };
        }

        try {
            let purgeCursorUntil = lease.state.cursorUntil
                ? new Date(lease.state.cursorUntil)
                : null;
            let windowPurged = 0;
            let windowsProcessed = 0;
            let batchIndex = 0;
            let hitIterationCap = false;

            if (options?.dryRun) {
                const oldest = await getOldestCreatedAt();
                let windowsWouldProcess = 0;
                if (oldest) {
                    let cursor = purgeCursorUntil ?? startOfUtcDay(oldest);
                    const now = new Date();
                    const backlogCutoff = addDaysUtc(startOfUtcDay(now), -retentionDays);
                    while (windowsWouldProcess < MAX_PURGE_ITERATIONS) {
                        const windowEnd = addDaysUtc(cursor, retentionDays);
                        const scheduleDue = windowEnd <= now;
                        const hasBacklog = oldest < backlogCutoff && cursor < backlogCutoff;
                        if (!scheduleDue && !hasBacklog) break;
                        windowsWouldProcess += 1;
                        cursor = windowEnd;
                    }
                }
                await releasePurgeLease(owner);
                return {
                    purgedCount: 0,
                    windowPurged: 0,
                    windowsProcessed: windowsWouldProcess,
                    dryRun: true,
                    purgeCursorUntil,
                    retentionDays,
                };
            }

            while (batchIndex < MAX_PURGE_ITERATIONS) {
                const now = new Date();
                const oldest = await getOldestCreatedAt();
                if (!oldest) break;

                if (!purgeCursorUntil) {
                    purgeCursorUntil = startOfUtcDay(oldest);
                }

                const windowEnd = addDaysUtc(purgeCursorUntil, retentionDays);
                const scheduleDue = windowEnd <= now;
                const backlogCutoff = addDaysUtc(startOfUtcDay(now), -retentionDays);
                const hasBacklog = oldest < backlogCutoff && purgeCursorUntil < backlogCutoff;

                if (!scheduleDue && !hasBacklog) {
                    break;
                }

                let windowDone = false;
                while (!windowDone && batchIndex < MAX_PURGE_ITERATIONS) {
                    const batch = await takeShardSizedBatch(purgeCursorUntil, windowEnd);
                    if (batch.length === 0) {
                        windowDone = true;
                        break;
                    }
                    const deleted = await archiveShardAndDelete(
                        batch,
                        purgeCursorUntil,
                        windowEnd,
                    );
                    windowPurged += deleted;
                    batchIndex += 1;
                    if (batch.length < env.AUDIT_LOG_SHARD_MAX_RECORDS) {
                        const remaining = await fetchBatchInWindow(
                            purgeCursorUntil,
                            windowEnd,
                            1,
                        );
                        if (remaining.length === 0) {
                            windowDone = true;
                        }
                    }
                }

                if (batchIndex >= MAX_PURGE_ITERATIONS && !windowDone) {
                    hitIterationCap = true;
                    break;
                }

                if (windowDone) {
                    purgeCursorUntil = windowEnd;
                    await setPurgeCursorUntil(purgeCursorUntil);
                    windowsProcessed += 1;
                }
            }

            await markSettingsLastPurge();
            await releasePurgeLease(owner, {
                cursorUntil: purgeCursorUntil,
                success: true,
            });

            return {
                purgedCount: windowPurged,
                windowPurged,
                windowsProcessed,
                batchCount: batchIndex,
                hitIterationCap,
                purgeCursorUntil,
                retentionDays,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logApi.error({ err }, "[AuditLogPurge] Failed");
            await releasePurgeLease(owner, { lastError: message, success: false });
            throw err;
        }
    },

    getFilterOptions() {
        return getAuditLogFilterOptions();
    },

    async getPurgeState() {
        return await getPurgeState();
    },
};

export type { AuditLogListQuery };
