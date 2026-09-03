import { and, desc, eq, sql } from "drizzle-orm";
import { logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { apiAuditLogs } from "../../db/schemas/api-audit-log.ts";
import { env } from "../../env.ts";
import { shouldLog } from "../audit-log-config/audit-log-config-cache.ts";

export type ViewAuditLogEntry = {
    requestId: string | null;
    userId: string | null;
    userRole: string | null;
    method: string;
    path: string;
    query: Record<string, string> | null;
    action: string;
    module: string | null;
    eventType: string | null;
    entityType: string | null;
    entityId: string | null;
    entityLabel: string | null;
    summary: string | null;
    sourceLogId: string | null;
    statusCode: number;
    responseTime: number | null;
    ip: string | null;
    userAgent: string | null;
    requestBody?: unknown;
    responseBody?: unknown;
    error?: string | null;
};

type PendingView = {
    entry: ViewAuditLogEntry;
    timer: ReturnType<typeof setTimeout>;
    listSessionKey: string;
};

/**
 * B2: Key dùng composite `${actor}:${listSessionKey}` thay vì chỉ actor.
 * Tránh bug: đổi trang trước dwell timer bắn → view cũ bị clearTimeout + ghi đè, mất hoàn toàn.
 * Với composite key: mỗi (actor, session) có entry riêng → cả 2 đều được ghi.
 */
const pendingByCompositeKey = new Map<string, PendingView>();

/**
 * Giới hạn số entry đồng thời để tránh memory leak khi nhiều user/session.
 * Khi vượt ngưỡng, evict entry cũ nhất (FIFO) và fire ngay thay vì đợi timer.
 */
const MAX_PENDING_VIEWS = 500;

function actorKey(entry: ViewAuditLogEntry): string {
    return entry.userId ?? `ip:${entry.ip ?? "unknown"}`;
}

export function buildListSessionKey(
    entry: Pick<ViewAuditLogEntry, "userId" | "module" | "path">,
): string {
    return `${entry.userId ?? "anon"}|${entry.module ?? ""}|${entry.path}`;
}

function compositeKey(entry: ViewAuditLogEntry): string {
    return `${actorKey(entry)}:${buildListSessionKey(entry)}`;
}

function logErr(err: unknown): void {
    logApi.error({ err }, "[AUDIT_BUFFER] Failed to persist buffered view");
}

async function insertView(entry: ViewAuditLogEntry): Promise<void> {
    if (entry.module && entry.eventType && !await shouldLog(entry.module, entry.eventType)) {
        return;
    }

    await db.insert(apiAuditLogs).values({
        requestId: entry.requestId,
        userId: entry.userId,
        userRole: entry.userRole,
        method: entry.method,
        path: entry.path,
        query: entry.query,
        action: entry.action,
        module: entry.module,
        eventType: entry.eventType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        summary: entry.summary,
        sourceLogId: entry.sourceLogId,
        statusCode: entry.statusCode,
        responseTime: entry.responseTime,
        ip: entry.ip,
        userAgent: entry.userAgent,
        requestBody: (entry.requestBody as Record<string, unknown> | null) ?? null,
        responseBody: (entry.responseBody as Record<string, unknown> | null) ?? null,
        error: entry.error ?? null,
        viewCount: 1,
    });
}

async function coalesceOrInsert(entry: ViewAuditLogEntry): Promise<void> {
    if (entry.module && entry.eventType && !await shouldLog(entry.module, entry.eventType)) {
        return;
    }

    const conditions = [
        eq(apiAuditLogs.eventType, "view"),
        eq(apiAuditLogs.path, entry.path),
    ];
    if (entry.userId) {
        conditions.push(eq(apiAuditLogs.userId, entry.userId));
    } else {
        conditions.push(sql`${apiAuditLogs.userId} IS NULL`);
    }
    if (entry.module) {
        conditions.push(eq(apiAuditLogs.module, entry.module));
    }

    const [existing] = await db.select({ id: apiAuditLogs.id })
        .from(apiAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(apiAuditLogs.createdAt))
        .limit(1);

    if (existing) {
        await db.update(apiAuditLogs).set({
            query: entry.query,
            summary: entry.summary,
            statusCode: entry.statusCode,
            responseTime: entry.responseTime,
            requestId: entry.requestId,
            viewCount: sql`${apiAuditLogs.viewCount} + 1`,
        }).where(eq(apiAuditLogs.id, existing.id));
        return;
    }

    await insertView(entry);
}

function firePending(key: string): void {
    const pending = pendingByCompositeKey.get(key);
    if (!pending) return;
    pendingByCompositeKey.delete(key);
    logApi.debug({ key, queueSize: pendingByCompositeKey.size }, "[AUDIT_BUFFER] Fire pending view");
    coalesceOrInsert(pending.entry).catch(logErr);
}

export function scheduleViewAuditLog(entry: ViewAuditLogEntry): void {
    const key = compositeKey(entry);
    const listSessionKey = buildListSessionKey(entry);
    const existing = pendingByCompositeKey.get(key);

    if (existing) {
        // B2 fix: cùng composite key (actor + session) → entry mới replace entry cũ cùng page.
        // Clear timer cũ, fire entry cũ ngay để không mất log (coalesce vào DB).
        clearTimeout(existing.timer);
        coalesceOrInsert(existing.entry).catch(logErr);
    } else if (pendingByCompositeKey.size >= MAX_PENDING_VIEWS) {
        // Eviction: Map quá lớn → fire FIFO entry cũ nhất ngay để giải phóng slot.
        const [oldestKey] = pendingByCompositeKey.keys();
        const oldest = pendingByCompositeKey.get(oldestKey)!;
        clearTimeout(oldest.timer);
        pendingByCompositeKey.delete(oldestKey);
        logApi.warn(
            { evictedKey: oldestKey, queueSize: pendingByCompositeKey.size },
            "[AUDIT_BUFFER] Evicted oldest pending view (queue full)",
        );
        coalesceOrInsert(oldest.entry).catch(logErr);
    }

    const timer = setTimeout(() => {
        firePending(key);
    }, env.AUDIT_LOG_VIEW_DWELL_MS);

    pendingByCompositeKey.set(key, { entry, timer, listSessionKey });
    logApi.debug(
        { key, queueSize: pendingByCompositeKey.size },
        "[AUDIT_BUFFER] Scheduled view",
    );
}
