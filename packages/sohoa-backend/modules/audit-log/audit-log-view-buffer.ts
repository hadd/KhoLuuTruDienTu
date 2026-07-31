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

const pendingByActor = new Map<string, PendingView>();

function actorKey(entry: ViewAuditLogEntry): string {
    return entry.userId ?? `ip:${entry.ip ?? "unknown"}`;
}

export function buildListSessionKey(
    entry: Pick<ViewAuditLogEntry, "userId" | "module" | "path">,
): string {
    return `${entry.userId ?? "anon"}|${entry.module ?? ""}|${entry.path}`;
}

async function insertView(entry: ViewAuditLogEntry): Promise<void> {
    if (entry.module && entry.eventType && !shouldLog(entry.module, entry.eventType)) {
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
    if (entry.module && entry.eventType && !shouldLog(entry.module, entry.eventType)) {
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

function firePending(actor: string, listSessionKey: string): void {
    const pending = pendingByActor.get(actor);
    if (!pending || pending.listSessionKey !== listSessionKey) {
        return;
    }
    pendingByActor.delete(actor);
    coalesceOrInsert(pending.entry).catch((err) => {
        logApi.error({ err }, "[AUDIT] Failed to persist buffered view");
    });
}

export function scheduleViewAuditLog(entry: ViewAuditLogEntry): void {
    const actor = actorKey(entry);
    const listSessionKey = buildListSessionKey(entry);
    const existing = pendingByActor.get(actor);

    if (existing) {
        clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
        firePending(actor, listSessionKey);
    }, env.AUDIT_LOG_VIEW_DWELL_MS);
    pendingByActor.set(actor, { entry, timer, listSessionKey });
}
