import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
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
import { buildAuditLogsExcel, serializeAuditLogsToJson } from "./audit-log-export.ts";

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

async function countRecords(query: AuditLogListQuery): Promise<number> {
    const where = buildListConditions(query);
    let countQuery = db.select({ count: sql<number>`cast(count(*) as int)` }).from(apiAuditLogs);
    if (where) {
        countQuery = countQuery.where(where) as typeof countQuery;
    }
    const [row] = await countQuery;
    return row?.count ?? 0;
}

function buildArchiveObjectKeys(timestamp: string) {
    const datePart = timestamp.slice(0, 10);
    const base = `audit-exports/${datePart}/audit-logs-${timestamp}`;
    return {
        jsonObjectKey: `${base}.json`,
        excelObjectKey: `${base}.xlsx`,
    };
}

export const AuditLogService = {
    ...crud,

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

        return {
            items: records,
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
        const records = await fetchRecords(query, { withoutPaging: true });
        if (format === "xlsx") {
            const data = await buildAuditLogsExcel(records);
            return {
                contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename: `audit-logs-${Date.now()}.xlsx`,
                data,
            };
        }
        const data = serializeAuditLogsToJson(records);
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

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - settings.retentionDays);

        const records = await db.select().from(apiAuditLogs)
            .where(lte(apiAuditLogs.createdAt, cutoff))
            .orderBy(desc(apiAuditLogs.createdAt));

        if (records.length === 0) {
            return { purgedCount: 0, recordCount: 0 };
        }

        if (options?.dryRun) {
            return { purgedCount: 0, recordCount: records.length, dryRun: true };
        }

        const dateFrom = records[records.length - 1]?.createdAt ?? cutoff;
        const dateTo = records[0]?.createdAt ?? cutoff;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const keys = buildArchiveObjectKeys(timestamp);

        const jsonData = serializeAuditLogsToJson(records);
        const excelData = await buildAuditLogsExcel(records);

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

        const deleted = await db.delete(apiAuditLogs)
            .where(lte(apiAuditLogs.createdAt, cutoff))
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

        await AuditLogConfigService.markPurgeCompleted();

        return {
            purgedCount: deleted.length,
            recordCount: records.length,
            archive: keys,
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
