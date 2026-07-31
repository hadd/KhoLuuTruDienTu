import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { createCrudService } from "@shared/base-crud";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    apiAuditLogs,
    apiAuditLogEntitySchema,
    type ApiAuditLog,
} from "../../db/schemas/api-audit-log.ts";
import { auditLogArchives } from "../../db/schemas/audit-log-archive.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { uploadBinaryToStorage } from "../../libs/archival-storage.ts";
import { AuditLogConfigService } from "../audit-log-config/audit-log-config-service.ts";
import { enrichAuditLogRecords } from "./audit-entity-resolver.ts";
import { buildAuditLogsExcel, serializeAuditLogsToJson, type AuditLogExportRecord } from "./audit-log-export.ts";
import { getAuditLogFilterOptions, resolveEventTypeFilter } from "./audit-log-filter-catalog.ts";
import { downloadJsonFromStorage } from "../data-entry/data-entry-s3-utils.ts";

const PURGE_BATCH_SIZE = 10_000;
const MAX_PURGE_ITERATIONS = 200;

async function getOldestCreatedAt(): Promise<Date | null> {
    const [row] = await db.select({ createdAt: apiAuditLogs.createdAt })
        .from(apiAuditLogs).orderBy(asc(apiAuditLogs.createdAt)).limit(1);
    return row?.createdAt ?? null;
}

async function countAll(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(apiAuditLogs);
    return row?.count ?? 0;
}

async function fetchOldestBatch(batchSize: number): Promise<ApiAuditLog[]> {
    return await db.select().from(apiAuditLogs)
        .orderBy(asc(apiAuditLogs.createdAt)).limit(batchSize);
}

async function fetchBatchInWindow(
    windowStart: Date,
    windowEnd: Date,
    batchSize: number,
): Promise<ApiAuditLog[]> {
    return await db.select().from(apiAuditLogs)
        .where(and(
            gte(apiAuditLogs.createdAt, windowStart),
            sql`${apiAuditLogs.createdAt} < ${windowEnd}`,
        ))
        .orderBy(asc(apiAuditLogs.createdAt))
        .limit(batchSize);
}

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

export type AuditLogListQuery = {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    module?: string;
    eventType?: string;
};

function parseDate(value: string | undefined): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildListConditions(query: AuditLogListQuery) {
    const conditions = [];
    if (query.userId) {
        conditions.push(eq(apiAuditLogs.userId, query.userId));
    }
    const dateFrom = parseDate(query.dateFrom);
    if (dateFrom) {
        conditions.push(gte(apiAuditLogs.createdAt, dateFrom));
    }
    const dateTo = parseDate(query.dateTo);
    if (dateTo) {
        conditions.push(lte(apiAuditLogs.createdAt, dateTo));
    }
    if (query.module) {
        conditions.push(eq(apiAuditLogs.module, query.module));
    }
    if (query.eventType) {
        const eventTypes = resolveEventTypeFilter(query.eventType, query.module);
        if (eventTypes && eventTypes.length === 1) {
            conditions.push(eq(apiAuditLogs.eventType, eventTypes[0]));
        } else if (eventTypes && eventTypes.length > 1) {
            conditions.push(inArray(apiAuditLogs.eventType, eventTypes));
        }
    }
    if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        conditions.push(or(
            sql`${apiAuditLogs.summary} ILIKE ${term}`,
            sql`${apiAuditLogs.path} ILIKE ${term}`,
            sql`${apiAuditLogs.action} ILIKE ${term}`,
            sql`${apiAuditLogs.module} ILIKE ${term}`,
            sql`${apiAuditLogs.entityLabel} ILIKE ${term}`,
            sql`EXISTS (
            SELECT 1 FROM ${userProfiles}
            WHERE ${userProfiles.id} = ${apiAuditLogs.userId}
              AND (${userProfiles.fullName} ILIKE ${term} OR ${userProfiles.email} ILIKE ${term})
        )`,
        ));
    }
    return conditions.length ? and(...conditions) : undefined;
}

async function fetchRecords(
    query: AuditLogListQuery,
    options?: { withoutPaging?: boolean },
): Promise<ApiAuditLog[]> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 200);
    const where = buildListConditions(query);

    let selectQuery = db.select().from(apiAuditLogs).orderBy(desc(apiAuditLogs.createdAt));
    if (where) {
        selectQuery = selectQuery.where(where) as typeof selectQuery;
    }
    if (!options?.withoutPaging) {
        selectQuery = selectQuery.limit(limit).offset((page - 1) * limit) as typeof selectQuery;
    }
    return await selectQuery;
}

async function fetchRecordsWithRelations(
    query: AuditLogListQuery,
    options?: { withoutPaging?: boolean },
) {
    const records = await fetchRecords(query, options);
    if (records.length === 0) return [];

    const ids = records.map((item) => item.id);
    return await db.query.apiAuditLogs.findMany({
        where: inArray(apiAuditLogs.id, ids),
        with: { user: true },
        orderBy: (logs, { desc: descFn }) => [descFn(logs.createdAt)],
    });
}

async function countRecords(query: AuditLogListQuery): Promise<number> {
    const where = buildListConditions(query);
    let countQuery = db.select({ count: sql<number>`cast(count(*) as int)` }).from(apiAuditLogs);
    if (where) {
        countQuery = countQuery.where(where) as typeof countQuery;
    }
    const [row] = await countQuery;
    return row?.count ?? 0;
}

function buildArchiveObjectKeys(timestamp: string, batchIndex = 0) {
    const datePart = timestamp.slice(0, 10);
    const suffix = batchIndex > 0 ? `-${batchIndex}` : "";
    const base = `audit-exports/${datePart}/audit-logs-${timestamp}${suffix}`;
    return {
        jsonObjectKey: `${base}.json`,
        excelObjectKey: `${base}.xlsx`,
    };
}

async function archiveAndDeleteBatch(records: ApiAuditLog[], batchIndex: number) {
    const enriched = await enrichAuditLogRecords(records);
    const dateFrom = records[0]?.createdAt ?? new Date();
    const dateTo = records[records.length - 1]?.createdAt ?? dateFrom;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const keys = buildArchiveObjectKeys(timestamp, batchIndex);

    const jsonData = serializeAuditLogsToJson(enriched);
    const excelData = await buildAuditLogsExcel(enriched);

    try {
        await uploadBinaryToStorage(keys.jsonObjectKey, jsonData, {
            contentType: "application/json",
        });
        await uploadBinaryToStorage(keys.excelObjectKey, excelData, {
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.insert(auditLogArchives).values({
            dateFrom,
            dateTo,
            recordCount: records.length,
            jsonObjectKey: keys.jsonObjectKey,
            excelObjectKey: keys.excelObjectKey,
            status: "failed",
            error: message,
        });
        throw httpError.serviceUnavailable(`Failed to archive audit logs before purge: ${message}`);
    }

    const ids = records.map((record) => record.id);
    const deleted = await db.delete(apiAuditLogs)
        .where(inArray(apiAuditLogs.id, ids))
        .returning();

    await db.insert(auditLogArchives).values({
        dateFrom,
        dateTo,
        recordCount: records.length,
        jsonObjectKey: keys.jsonObjectKey,
        excelObjectKey: keys.excelObjectKey,
        purgedCount: deleted.length,
        status: "purged",
    });

    return deleted.length;
}

export const AuditLogService = {
    ...crud,

    async get(id: string) {
        const record = await crud.get(id) as ApiAuditLog & { user?: typeof userProfiles.$inferSelect | null };
        const [enriched] = await enrichAuditLogRecords([record]);
        return enriched;
    },

    async listFiltered(query: AuditLogListQuery) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 200);
        const where = buildListConditions(query);

        let selectQuery = db.select().from(apiAuditLogs).orderBy(desc(apiAuditLogs.createdAt));
        if (where) {
            selectQuery = selectQuery.where(where) as typeof selectQuery;
        }

        const [items, total] = await Promise.all([
            selectQuery.limit(limit).offset((page - 1) * limit),
            countRecords(query),
        ]);

        if (items.length === 0) {
            return { items: [], page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
        }

        const ids = items.map((item) => item.id);
        const records = await db.query.apiAuditLogs.findMany({
            where: inArray(apiAuditLogs.id, ids),
            with: { user: true },
            orderBy: (logs, { desc: descFn }) => [descFn(logs.createdAt)],
        });

        const enrichedItems = await enrichAuditLogRecords(records);

        return {
            items: enrichedItems,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        };
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
            const where = buildListConditions(input.query);
            if (!where) {
                throw httpError.badRequest("Filter is required for bulk delete");
            }
            const deleted = await db.delete(apiAuditLogs).where(where).returning();
            return { deletedCount: deleted.length };
        }
        throw httpError.badRequest("ids or query filter is required");
    },

    async exportRecords(query: AuditLogListQuery, format: "json" | "xlsx") {
        const records = await fetchRecordsWithRelations(query, { withoutPaging: true });
        const enriched = await enrichAuditLogRecords(records);
        if (format === "xlsx") {
            const data = await buildAuditLogsExcel(enriched);
            return {
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename: `audit-logs-${Date.now()}.xlsx`,
                data,
            };
        }
        const data = serializeAuditLogsToJson(enriched);
        return {
            contentType: "application/json",
            filename: `audit-logs-${Date.now()}.json`,
            data,
        };
    },

    async purgeExpired(options?: { dryRun?: boolean }) {
        const settings = await AuditLogConfigService.getSettings();
        if (!settings.purgeEnabled) {
            return { skipped: true, reason: "purge_disabled" as const };
        }

        const retentionDays = settings.retentionDays;
        const maxRecords = settings.maxRecords != null && settings.maxRecords > 0
            ? settings.maxRecords
            : null;

        let countPurged = 0;
        let windowPurged = 0;
        let windowsProcessed = 0;
        let batchIndex = 0;
        let purgeCursorUntil = settings.purgeCursorUntil
            ? new Date(settings.purgeCursorUntil)
            : null;
        let hitIterationCap = false;

        if (options?.dryRun) {
            const total = await countAll();
            const oldest = await getOldestCreatedAt();
            const countWouldPurge = maxRecords != null && total > maxRecords ? maxRecords : 0;
            let windowsWouldProcess = 0;
            if (oldest) {
                let cursor = purgeCursorUntil ?? startOfUtcDay(oldest);
                const now = new Date();
                const backlogCutoff = addDaysUtc(now, -retentionDays);
                while (windowsWouldProcess < MAX_PURGE_ITERATIONS) {
                    const windowEnd = addDaysUtc(cursor, retentionDays);
                    const scheduleDue = windowEnd <= now;
                    const hasBacklog = oldest < backlogCutoff && cursor < backlogCutoff;
                    if (!scheduleDue && !hasBacklog) break;
                    windowsWouldProcess += 1;
                    cursor = windowEnd;
                }
            }
            return {
                purgedCount: 0,
                countPurged: 0,
                windowPurged: 0,
                windowsProcessed: windowsWouldProcess,
                countWouldPurge,
                dryRun: true,
                purgeCursorUntil,
            };
        }

        // Outer loop: alternate count-triggered and calendar-window purges until idle.
        while (batchIndex < MAX_PURGE_ITERATIONS) {
            let didWork = false;
            const now = new Date();

            // 1) Count purge: when over threshold, delete exactly maxRecords oldest.
            if (maxRecords != null) {
                const total = await countAll();
                if (total > maxRecords) {
                    let remaining = maxRecords;
                    while (remaining > 0 && batchIndex < MAX_PURGE_ITERATIONS) {
                        const batchSize = Math.min(PURGE_BATCH_SIZE, remaining);
                        const batch = await fetchOldestBatch(batchSize);
                        if (batch.length === 0) break;
                        const deleted = await archiveAndDeleteBatch(batch, batchIndex);
                        countPurged += deleted;
                        remaining -= batch.length;
                        batchIndex += 1;
                        didWork = true;
                    }
                }
            }

            if (batchIndex >= MAX_PURGE_ITERATIONS) {
                hitIterationCap = true;
                break;
            }

            // 2) Calendar window purge (scheduled + backlog catch-up).
            const oldest = await getOldestCreatedAt();
            if (!oldest) break;

            if (!purgeCursorUntil) {
                purgeCursorUntil = startOfUtcDay(oldest);
            }

            const windowEnd = addDaysUtc(purgeCursorUntil, retentionDays);
            const scheduleDue = windowEnd <= now;
            const backlogCutoff = addDaysUtc(now, -retentionDays);
            const hasBacklog = oldest < backlogCutoff && purgeCursorUntil < backlogCutoff;

            if (!scheduleDue && !hasBacklog) {
                if (!didWork) break;
                continue;
            }

            // Purge all logs in [cursor, cursor + retentionDays), then advance cursor.
            let windowDone = false;
            while (!windowDone && batchIndex < MAX_PURGE_ITERATIONS) {
                const batch = await fetchBatchInWindow(
                    purgeCursorUntil,
                    windowEnd,
                    PURGE_BATCH_SIZE,
                );
                if (batch.length === 0) {
                    windowDone = true;
                    break;
                }
                const deleted = await archiveAndDeleteBatch(batch, batchIndex);
                windowPurged += deleted;
                batchIndex += 1;
                didWork = true;
                if (batch.length < PURGE_BATCH_SIZE) {
                    windowDone = true;
                }
            }

            if (batchIndex >= MAX_PURGE_ITERATIONS && !windowDone) {
                hitIterationCap = true;
                break;
            }

            if (windowDone) {
                purgeCursorUntil = windowEnd;
                await AuditLogConfigService.setPurgeCursorUntil(purgeCursorUntil);
                windowsProcessed += 1;
            }
        }

        await AuditLogConfigService.markPurgeCompleted();

        return {
            purgedCount: countPurged + windowPurged,
            countPurged,
            windowPurged,
            windowsProcessed,
            batchCount: batchIndex,
            hitIterationCap,
            purgeCursorUntil,
        };
    },

    async listArchives(query: {
        page?: number;
        limit?: number;
        dateFrom?: string;
        dateTo?: string;
        filterBy?: "logRange" | "exportedAt";
    }) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 100);
        const conditions = [];

        const rangeFrom = parseDate(query.dateFrom);
        const rangeTo = parseDate(query.dateTo);
        if (rangeFrom || rangeTo) {
            const overlapStart = rangeFrom ?? rangeTo!;
            const overlapEnd = rangeTo ?? rangeFrom!;
            const endOfDay = new Date(overlapEnd);
            endOfDay.setUTCHours(23, 59, 59, 999);

            if (query.filterBy === "exportedAt") {
                conditions.push(gte(auditLogArchives.exportedAt, overlapStart));
                conditions.push(lte(auditLogArchives.exportedAt, endOfDay));
            } else {
                conditions.push(gte(auditLogArchives.dateTo, overlapStart));
                conditions.push(lte(auditLogArchives.dateFrom, endOfDay));
            }
        }

        const where = conditions.length ? and(...conditions) : undefined;

        let listQuery = db.select().from(auditLogArchives)
            .orderBy(desc(auditLogArchives.exportedAt))
            .limit(limit)
            .offset((page - 1) * limit);
        if (where) {
            listQuery = listQuery.where(where) as typeof listQuery;
        }

        let countQuery = db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogArchives);
        if (where) {
            countQuery = countQuery.where(where) as typeof countQuery;
        }

        const [items, totalRow] = await Promise.all([listQuery, countQuery]);
        const total = totalRow[0]?.count ?? 0;
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        };
    },

    getFilterOptions() {
        return getAuditLogFilterOptions();
    },

    async listArchiveRecordsById(
        archiveId: string,
        query: {
            page?: number;
            limit?: number;
            search?: string;
            module?: string;
            eventType?: string;
        },
    ) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 200);
        const archive = await this.getArchive(archiveId);

        if (archive.status !== "purged" || !archive.jsonObjectKey) {
            throw httpError.badRequest("Archive has no readable records");
        }

        const raw = await downloadJsonFromStorage(archive.jsonObjectKey);
        if (!Array.isArray(raw)) {
            throw httpError.badRequest("Archive JSON is not a valid record list");
        }

        const filtered: AuditLogExportRecord[] = [];
        for (const item of raw) {
            const record = item as AuditLogExportRecord;

            if (query.module && record.module !== query.module) continue;

            const eventTypes = resolveEventTypeFilter(query.eventType, query.module);
            if (eventTypes && !eventTypes.includes(record.eventType ?? "")) continue;

            if (query.search?.trim()) {
                const term = query.search.trim().toLowerCase();
                const haystack = [
                    record.summary,
                    record.path,
                    record.action,
                    record.module,
                    record.entityLabel,
                    record.user?.fullName,
                    record.user?.email,
                ].filter(Boolean).join(" ").toLowerCase();
                if (!haystack.includes(term)) continue;
            }

            filtered.push(record);
        }

        filtered.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });

        const total = filtered.length;
        const start = (page - 1) * limit;
        const items = filtered.slice(start, start + limit);

        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
            archive: {
                id: archive.id,
                dateFrom: archive.dateFrom,
                dateTo: archive.dateTo,
                recordCount: archive.recordCount,
                exportedAt: archive.exportedAt,
            },
        };
    },

    async getArchive(id: string) {
        const record = await db.query.auditLogArchives.findFirst({
            where: eq(auditLogArchives.id, id),
        });
        if (!record) {
            throw httpError.notFound("Audit log archive not found");
        }
        return record;
    },
};
