import { and, gte, inArray, lte, eq, sql } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { auditLogArchiveShards } from "../../db/schemas/audit-log-archive-shard.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { env } from "../../env.ts";
import { queryDuckDb } from "./audit-log-cold-duckdb.ts";
import { resolveEventTypeFilter } from "./audit-log-filter-catalog.ts";
import type { AuditLogListQuery } from "./audit-log-unified-query.ts";
import type { ShardRecord } from "./audit-log-archive-io.ts";

function parseDate(value: string | undefined): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Pruning Candidate Shards: Lấy danh sách `objectKey` của các shard phù hợp với thời gian query
 * để truyền vào DuckDB (tránh quét glob toàn bộ bucket MinIO).
 */
export async function resolveCandidateShards(query: AuditLogListQuery): Promise<string[]> {
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);

    const conditions = [eq(auditLogArchiveShards.status, "ready")];
    if (dateFrom) {
        conditions.push(gte(auditLogArchiveShards.maxCreatedAt, dateFrom));
    }
    if (dateTo) {
        conditions.push(lte(auditLogArchiveShards.minCreatedAt, dateTo));
    }

    const shards = await db.select({ objectKey: auditLogArchiveShards.objectKey })
        .from(auditLogArchiveShards)
        .where(and(...conditions));

    return shards.map((s) => s.objectKey);
}

/**
 * Xử lý tìm kiếm user theo tên / email từ PostgreSQL `user_profiles` trước khi truyền vào DuckDB
 * (do DuckDB query trên MinIO không join trực tiếp được bảng user_profiles trên Postgres).
 */
async function resolveUserIdsFromSearch(searchTerm: string): Promise<string[]> {
    const term = `%${searchTerm.trim()}%`;
    const users = await db.select({ id: userProfiles.id })
        .from(userProfiles)
        .where(sql`${userProfiles.fullName} ILIKE ${term} OR ${userProfiles.email} ILIKE ${term}`);

    return users.map((u) => u.id);
}

/**
 * Xây dựng mệnh đề WHERE SQL cho DuckDB với explicit CAST(createdAt AS TIMESTAMPTZ)
 */
async function buildColdWhereSql(query: AuditLogListQuery): Promise<string> {
    const conditions: string[] = [];

    if (query.userId) {
        conditions.push(`userId = '${query.userId.replace(/'/g, "''")}'`);
    }

    const dateFrom = parseDate(query.dateFrom);
    if (dateFrom) {
        conditions.push(`CAST(createdAt AS TIMESTAMPTZ) >= CAST('${dateFrom.toISOString()}' AS TIMESTAMPTZ)`);
    }

    const dateTo = parseDate(query.dateTo);
    if (dateTo) {
        conditions.push(`CAST(createdAt AS TIMESTAMPTZ) <= CAST('${dateTo.toISOString()}' AS TIMESTAMPTZ)`);
    }

    if (query.module) {
        conditions.push(`module = '${query.module.replace(/'/g, "''")}'`);
    }

    if (query.eventType) {
        const eventTypes = resolveEventTypeFilter(query.eventType, query.module);
        if (eventTypes && eventTypes.length === 1) {
            conditions.push(`eventType = '${eventTypes[0].replace(/'/g, "''")}'`);
        } else if (eventTypes && eventTypes.length > 1) {
            const typesStr = eventTypes.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ");
            conditions.push(`eventType IN (${typesStr})`);
        }
    }

    if (query.search?.trim()) {
        const rawTerm = query.search.trim().replace(/'/g, "''").toLowerCase();
        const matchedUserIds = await resolveUserIdsFromSearch(query.search);

        const textSearchConds = [
            `LOWER(summary) LIKE '%${rawTerm}%'`,
            `LOWER(path) LIKE '%${rawTerm}%'`,
            `LOWER(action) LIKE '%${rawTerm}%'`,
            `LOWER(module) LIKE '%${rawTerm}%'`,
            `LOWER(entityLabel) LIKE '%${rawTerm}%'`,
        ];

        if (matchedUserIds.length > 0) {
            const userIdsStr = matchedUserIds.map((id) => `'${id}'`).join(", ");
            textSearchConds.push(`userId IN (${userIdsStr})`);
        }

        conditions.push(`(${textSearchConds.join(" OR ")})`);
    }

    return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

function buildS3Source(objectKeys: string[]): string {
    const bucket = env.S3?.bucket || "aip-secure-bucket";
    if (objectKeys.length === 0) {
        return `read_json_auto([])`;
    }
    const pathsStr = objectKeys.map((k) => `'s3://${bucket}/${k}'`).join(", ");
    return `read_json_auto([${pathsStr}])`;
}

/**
 * Đếm số lượng bản ghi cold theo query từ DuckDB.
 */
export async function countCold(query: AuditLogListQuery): Promise<number> {
    const objectKeys = await resolveCandidateShards(query);
    if (objectKeys.length === 0) return 0;

    const source = buildS3Source(objectKeys);
    const whereSql = await buildColdWhereSql(query);

    const sqlStr = `SELECT CAST(COUNT(*) AS INTEGER) as total FROM ${source} ${whereSql}`;
    const [row] = await queryDuckDb<{ total: number }>(sqlStr);
    return row?.total ?? 0;
}

/**
 * Truy vấn danh sách bản ghi cold phân trang từ DuckDB.
 */
export async function fetchColdPage(
    query: AuditLogListQuery,
    limit: number,
    offset: number,
): Promise<ShardRecord[]> {
    const objectKeys = await resolveCandidateShards(query);
    if (objectKeys.length === 0) return [];

    const source = buildS3Source(objectKeys);
    const whereSql = await buildColdWhereSql(query);

    const sqlStr = `
        SELECT * FROM ${source} 
        ${whereSql} 
        ORDER BY CAST(createdAt AS TIMESTAMPTZ) DESC, id DESC 
        LIMIT ${limit} OFFSET ${offset}
    `;

    return await queryDuckDb<ShardRecord>(sqlStr);
}

/**
 * Truy vấn dữ liệu cold cho Export (kèm kiểm tra giới hạn max records).
 */
export async function fetchColdForExport(
    query: AuditLogListQuery,
    maxLimit: number,
): Promise<ShardRecord[]> {
    const objectKeys = await resolveCandidateShards(query);
    if (objectKeys.length === 0) return [];

    const source = buildS3Source(objectKeys);
    const whereSql = await buildColdWhereSql(query);

    const sqlStr = `
        SELECT * FROM ${source} 
        ${whereSql} 
        ORDER BY CAST(createdAt AS TIMESTAMPTZ) DESC, id DESC 
        LIMIT ${maxLimit}
    `;

    return await queryDuckDb<ShardRecord>(sqlStr);
}

/**
 * Lookup 1 bản ghi cold theo id từ DuckDB thông qua `audit_log_archive_shards.record_ids`.
 */
export async function fetchColdById(id: string): Promise<ShardRecord | null> {
    const [shard] = await db.select({ objectKey: auditLogArchiveShards.objectKey })
        .from(auditLogArchiveShards)
        .where(
            and(
                eq(auditLogArchiveShards.status, "ready"),
                sql`${auditLogArchiveShards.recordIds} @> ARRAY[${id}]::text[]`,
            ),
        )
        .limit(1);

    if (!shard) return null;

    const bucket = env.S3?.bucket || "aip-secure-bucket";
    const source = `read_json_auto(['s3://${bucket}/${shard.objectKey}'])`;
    const sqlStr = `SELECT * FROM ${source} WHERE id = '${id.replace(/'/g, "''")}' LIMIT 1`;

    const [record] = await queryDuckDb<ShardRecord>(sqlStr);
    return record ?? null;
}
