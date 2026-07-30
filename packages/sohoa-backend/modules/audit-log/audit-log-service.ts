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
import { buildAuditLogsExcel, serializeAuditLogsToJson } from "./audit-log-export.ts";

const PURGE_BATCH_SIZE = 10_000;

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
        conditions.push(eq(apiAuditLogs.eventType, query.eventType));
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

async function collectPurgeCandidates(settings: {
    retentionDays: number;
    maxRecords: number | null;
}) {
    const candidateMap = new Map<string, ApiAuditLog>();
    let byRetention = 0;
    let byMaxRecords = 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.retentionDays);

    const expiredRecords = await db.select().from(apiAuditLogs)
        .where(lte(apiAuditLogs.createdAt, cutoff));
    for (const record of expiredRecords) {
        candidateMap.set(record.id, record);
        byRetention += 1;
    }

    if (settings.maxRecords != null && settings.maxRecords > 0) {
        const [totalRow] = await db.select({ count: sql<number>`cast(count(*) as int)` })
            .from(apiAuditLogs);
        const total = totalRow?.count ?? 0;
        if (total > settings.maxRecords) {
            const excess = total - settings.maxRecords;
            const oldestRecords = await db.select().from(apiAuditLogs)
                .orderBy(asc(apiAuditLogs.createdAt))
                .limit(excess);
            for (const record of oldestRecords) {
                if (!candidateMap.has(record.id)) {
                    byMaxRecords += 1;
                }
                candidateMap.set(record.id, record);
            }
        }
    }

    const candidates = [...candidateMap.values()]
        .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

    return { candidates, byRetention, byMaxRecords };
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

        const { candidates, byRetention, byMaxRecords } = await collectPurgeCandidates(settings);

        if (candidates.length === 0) {
            return { purgedCount: 0, recordCount: 0, byRetention, byMaxRecords };
        }

        if (options?.dryRun) {
            return {
                purgedCount: 0,
                recordCount: candidates.length,
                byRetention,
                byMaxRecords,
                dryRun: true,
            };
        }

        let purgedCount = 0;
        let batchIndex = 0;
        for (let offset = 0; offset < candidates.length; offset += PURGE_BATCH_SIZE) {
            const batch = candidates.slice(offset, offset + PURGE_BATCH_SIZE);
            purgedCount += await archiveAndDeleteBatch(batch, batchIndex);
            batchIndex += 1;
        }

        await AuditLogConfigService.markPurgeCompleted();

        return {
            purgedCount,
            recordCount: candidates.length,
            byRetention,
            byMaxRecords,
            batchCount: batchIndex,
        };
    },

    async listArchives(query: { page?: number; limit?: number }) {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 100);
        const [items, totalRow] = await Promise.all([
            db.select().from(auditLogArchives)
                .orderBy(desc(auditLogArchives.exportedAt))
                .limit(limit)
                .offset((page - 1) * limit),
            db.select({ count: sql<number>`cast(count(*) as int)` }).from(auditLogArchives),
        ]);
        const total = totalRow[0]?.count ?? 0;
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
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
