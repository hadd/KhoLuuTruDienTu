import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    apiAuditLogs,
    type ApiAuditLog,
} from "../../db/schemas/api-audit-log.ts";
import { auditLogArchiveProjections } from "../../db/schemas/audit-log-archive-projection.ts";
import { auditLogArchiveShards } from "../../db/schemas/audit-log-archive-shard.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { env } from "../../env.ts";
import { enrichAuditLogRecords } from "./audit-entity-resolver.ts";
import {
    buildAuditLogsExcel,
    serializeAuditLogsToJson,
    type AuditLogExportRecord,
} from "./audit-log-export.ts";
import { downloadAndParseShard, findRecordInShard } from "./audit-log-archive-io.ts";
import { resolveEventTypeFilter } from "./audit-log-filter-catalog.ts";

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

export type UnifiedAuditLogItem = AuditLogExportRecord & {
    source: "live" | "archived";
    viewCount?: number;
};

function parseDate(value: string | undefined): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildLiveConditions(query: AuditLogListQuery) {
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

function buildProjectionConditions(query: AuditLogListQuery) {
    const conditions = [];
    if (query.userId) {
        conditions.push(eq(auditLogArchiveProjections.userId, query.userId));
    }
    const dateFrom = parseDate(query.dateFrom);
    if (dateFrom) {
        conditions.push(gte(auditLogArchiveProjections.createdAt, dateFrom));
    }
    const dateTo = parseDate(query.dateTo);
    if (dateTo) {
        conditions.push(lte(auditLogArchiveProjections.createdAt, dateTo));
    }
    if (query.module) {
        conditions.push(eq(auditLogArchiveProjections.module, query.module));
    }
    if (query.eventType) {
        const eventTypes = resolveEventTypeFilter(query.eventType, query.module);
        if (eventTypes && eventTypes.length === 1) {
            conditions.push(eq(auditLogArchiveProjections.eventType, eventTypes[0]));
        } else if (eventTypes && eventTypes.length > 1) {
            conditions.push(inArray(auditLogArchiveProjections.eventType, eventTypes));
        }
    }
    if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        conditions.push(or(
            sql`${auditLogArchiveProjections.summary} ILIKE ${term}`,
            sql`${auditLogArchiveProjections.path} ILIKE ${term}`,
            sql`${auditLogArchiveProjections.action} ILIKE ${term}`,
            sql`${auditLogArchiveProjections.module} ILIKE ${term}`,
            sql`${auditLogArchiveProjections.entityLabel} ILIKE ${term}`,
            sql`EXISTS (
            SELECT 1 FROM ${userProfiles}
            WHERE ${userProfiles.id} = ${auditLogArchiveProjections.userId}
              AND (${userProfiles.fullName} ILIKE ${term} OR ${userProfiles.email} ILIKE ${term})
        )`,
        ));
    }
    return conditions.length ? and(...conditions) : undefined;
}

function compareCreatedDesc(
    a: { createdAt: Date | string | null; id: string },
    b: { createdAt: Date | string | null; id: string },
): number {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
}

async function countLive(query: AuditLogListQuery): Promise<number> {
    const where = buildLiveConditions(query);
    let countQuery = db.select({ count: sql<number>`cast(count(*) as int)` }).from(apiAuditLogs);
    if (where) {
        countQuery = countQuery.where(where) as typeof countQuery;
    }
    const [row] = await countQuery;
    return row?.count ?? 0;
}

async function countProjection(query: AuditLogListQuery): Promise<number> {
    const where = buildProjectionConditions(query);
    let countQuery = db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(auditLogArchiveProjections);
    if (where) {
        countQuery = countQuery.where(where) as typeof countQuery;
    }
    const [row] = await countQuery;
    return row?.count ?? 0;
}

async function fetchLivePage(query: AuditLogListQuery, fetchLimit: number, offset: number) {
    const where = buildLiveConditions(query);
    let selectQuery = db.select().from(apiAuditLogs).orderBy(desc(apiAuditLogs.createdAt));
    if (where) {
        selectQuery = selectQuery.where(where) as typeof selectQuery;
    }
    return await selectQuery.limit(fetchLimit).offset(offset);
}

async function fetchProjectionPage(query: AuditLogListQuery, fetchLimit: number, offset: number) {
    const where = buildProjectionConditions(query);
    let selectQuery = db.select().from(auditLogArchiveProjections)
        .orderBy(desc(auditLogArchiveProjections.createdAt));
    if (where) {
        selectQuery = selectQuery.where(where) as typeof selectQuery;
    }
    return await selectQuery.limit(fetchLimit).offset(offset);
}

async function hydrateLive(ids: string[]) {
    if (ids.length === 0) return [];
    const records = await db.query.apiAuditLogs.findMany({
        where: inArray(apiAuditLogs.id, ids),
        with: { user: true },
    });
    return await enrichAuditLogRecords(records);
}

async function hydrateProjections(
    projections: Array<typeof auditLogArchiveProjections.$inferSelect>,
): Promise<UnifiedAuditLogItem[]> {
    if (projections.length === 0) return [];

    const userIds = [...new Set(
        projections.map((row) => row.userId).filter((id): id is string => Boolean(id)),
    )];
    const users = userIds.length
        ? await db.select({
            id: userProfiles.id,
            email: userProfiles.email,
            fullName: userProfiles.fullName,
        }).from(userProfiles).where(inArray(userProfiles.id, userIds))
        : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    return projections.map((row) => ({
        id: row.id,
        requestId: null,
        userId: row.userId,
        userRole: row.userRole,
        method: row.method,
        path: row.path,
        query: null,
        action: row.action,
        module: row.module,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        entityLabel: row.entityLabel,
        summary: row.summary,
        sourceLogId: null,
        statusCode: row.statusCode,
        responseTime: null,
        ip: null,
        userAgent: null,
        requestBody: null,
        responseBody: null,
        error: null,
        createdAt: row.createdAt,
        viewCount: row.viewCount,
        user: row.userId ? userMap.get(row.userId) ?? null : null,
        entity: row.entityType && row.entityId
            ? {
                type: row.entityType,
                id: row.entityId,
                label: row.entityLabel ?? row.entityId,
                exists: false,
            }
            : null,
        source: "archived" as const,
    }));
}

export async function listUnified(query: AuditLogListQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 200);
    const offset = (page - 1) * limit;
    const fetchLimit = offset + limit;

    const [liveRows, projectionRows, liveTotal, archivedTotal] = await Promise.all([
        fetchLivePage(query, fetchLimit, 0),
        fetchProjectionPage(query, fetchLimit, 0),
        countLive(query),
        countProjection(query),
    ]);

    const mergedMeta = [
        ...liveRows.map((row) => ({ id: row.id, createdAt: row.createdAt, source: "live" as const })),
        ...projectionRows.map((row) => ({
            id: row.id,
            createdAt: row.createdAt,
            source: "archived" as const,
        })),
    ].sort(compareCreatedDesc).slice(offset, offset + limit);

    const liveIds = mergedMeta.filter((row) => row.source === "live").map((row) => row.id);
    const archivedIds = new Set(
        mergedMeta.filter((row) => row.source === "archived").map((row) => row.id),
    );
    const archivedProjections = projectionRows.filter((row) => archivedIds.has(row.id));

    const [liveHydrated, archivedHydrated] = await Promise.all([
        hydrateLive(liveIds),
        hydrateProjections(archivedProjections),
    ]);

    const liveMap = new Map(liveHydrated.map((row) => [row.id, { ...row, source: "live" as const }]));
    const archivedMap = new Map(archivedHydrated.map((row) => [row.id, row]));

    const items: UnifiedAuditLogItem[] = [];
    for (const meta of mergedMeta) {
        const item = meta.source === "live" ? liveMap.get(meta.id) : archivedMap.get(meta.id);
        if (item) items.push(item as UnifiedAuditLogItem);
    }

    const total = liveTotal + archivedTotal;
    return {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
    };
}

export async function getUnifiedById(id: string): Promise<UnifiedAuditLogItem> {
    const live = await db.query.apiAuditLogs.findFirst({
        where: eq(apiAuditLogs.id, id),
        with: { user: true },
    });
    if (live) {
        const [enriched] = await enrichAuditLogRecords([live]);
        return { ...enriched, source: "live" };
    }

    const projection = await db.select().from(auditLogArchiveProjections)
        .where(eq(auditLogArchiveProjections.id, id))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    if (!projection) {
        throw httpError.notFound("Audit log not found");
    }

    const shard = await db.select().from(auditLogArchiveShards)
        .where(eq(auditLogArchiveShards.id, projection.shardId))
        .limit(1)
        .then((rows) => rows[0] ?? null);
    if (!shard || shard.status !== "ready") {
        throw httpError.notFound("Archive shard not found");
    }

    const record = await findRecordInShard(shard.objectKey, id);
    if (!record) {
        throw httpError.notFound("Audit log not found in archive shard");
    }

    const [hydrated] = await hydrateProjections([{
        ...projection,
        ...{
            id: record.id,
            createdAt: record.createdAt instanceof Date
                ? record.createdAt
                : new Date(String(record.createdAt)),
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
            viewCount: record.viewCount ?? projection.viewCount,
            shardId: projection.shardId,
        },
    }]);

    return {
        ...hydrated,
        ...record,
        requestBody: record.requestBody ?? null,
        responseBody: record.responseBody ?? null,
        ip: record.ip ?? null,
        userAgent: record.userAgent ?? null,
        query: record.query ?? null,
        responseTime: record.responseTime ?? null,
        source: "archived",
    };
}

async function collectExportRecords(query: AuditLogListQuery): Promise<UnifiedAuditLogItem[]> {
    const max = env.AUDIT_LOG_EXPORT_MAX_RECORDS;
    const [liveTotal, archivedTotal] = await Promise.all([
        countLive(query),
        countProjection(query),
    ]);
    if (liveTotal + archivedTotal > max) {
        throw httpError.badRequest(
            `Export exceeds limit of ${max} records (matched ${liveTotal + archivedTotal})`,
        );
    }

    const liveWhere = buildLiveConditions(query);
    let liveQuery = db.select().from(apiAuditLogs).orderBy(desc(apiAuditLogs.createdAt));
    if (liveWhere) {
        liveQuery = liveQuery.where(liveWhere) as typeof liveQuery;
    }
    const liveRows = await liveQuery.limit(max);

    const projWhere = buildProjectionConditions(query);
    let projQuery = db.select().from(auditLogArchiveProjections)
        .orderBy(desc(auditLogArchiveProjections.createdAt));
    if (projWhere) {
        projQuery = projQuery.where(projWhere) as typeof projQuery;
    }
    const projections = await projQuery.limit(max);

    const liveHydrated = await hydrateLive(liveRows.map((row) => row.id));
    const liveItems: UnifiedAuditLogItem[] = liveHydrated.map((row) => ({
        ...row,
        source: "live" as const,
    }));

    const shardIds = [...new Set(projections.map((row) => row.shardId))];
    const shardMap = new Map<string, typeof auditLogArchiveShards.$inferSelect>();
    if (shardIds.length > 0) {
        const shards = await db.select().from(auditLogArchiveShards)
            .where(inArray(auditLogArchiveShards.id, shardIds));
        for (const shard of shards) {
            shardMap.set(shard.id, shard);
        }
    }

    const fullById = new Map<string, AuditLogExportRecord>();
    for (const shardId of shardIds) {
        const shard = shardMap.get(shardId);
        if (!shard || shard.status !== "ready") continue;
        const records = await downloadAndParseShard(shard.objectKey);
        for (const record of records) {
            fullById.set(record.id, record);
        }
    }

    const archivedItems: UnifiedAuditLogItem[] = [];
    for (const projection of projections) {
        const full = fullById.get(projection.id);
        if (full) {
            archivedItems.push({ ...full, source: "archived", viewCount: projection.viewCount });
        } else {
            const [fallback] = await hydrateProjections([projection]);
            archivedItems.push(fallback);
        }
    }

    return [...liveItems, ...archivedItems].sort(compareCreatedDesc).slice(0, max);
}

export async function exportUnified(query: AuditLogListQuery, format: "json" | "xlsx") {
    const records = await collectExportRecords(query);
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
}

export { buildLiveConditions, parseDate };
