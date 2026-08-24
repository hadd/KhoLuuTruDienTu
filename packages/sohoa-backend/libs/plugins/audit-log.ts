import { Elysia } from "elysia";
import { logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { apiAuditLogs } from "../../db/schemas/api-audit-log.ts";
import type { UserWithRoles } from "./auth-profile.ts";
import { shouldLog } from "../../modules/audit-log-config/audit-log-config-cache.ts";
import {
    type AuditRequestMeta,
    type RequestWithAuditMeta,
    normalizeAuditModule,
    resolveEventTypeFromMethod,
    resolveModuleFromPath,
} from "../../modules/audit-log/audit-log-activity.ts";
import { deriveAuditFromPath } from "../../modules/audit-log/audit-path-derive.ts";
import { resolveRouteAudit } from "../../modules/audit-log/audit-route-resolve.ts";
import { resolveClientIp } from "../resolve-client-ip.ts";
import { scheduleViewAuditLog } from "../../modules/audit-log/audit-log-view-buffer.ts";

const SENSITIVE_KEYS = new Set([
    "password",
    "token",
    "secret",
    "apikey",
    "otp",
    "pin",
    "authorization",
    "accesspassword",
    "currentaccesspassword",
]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface AuditLogEntry {
    requestId: string | null;
    timestamp: string;
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
    summaryKey?: string | null;
    summaryParams?: Record<string, unknown> | null;
    sourceLogId: string | null;
    statusCode: number;
    responseTime: number | null;
    ip: string | null;
    userAgent: string | null;
    requestBody?: unknown;
    responseBody?: unknown;
    error?: string | null;
}

export interface AuditLogOptions {
    logResponseBody?: boolean;
    logResponseBodyOnError?: boolean;
    maxResponseBodySize?: number;
}

/**
 * Snapshot các field cần thiết đồng bộ từ ctx trước khi async enrich.
 * Tất cả field phải được đọc trong onAfterHandle (sync), không đọc sau.
 */
type AuditSnapshot = {
    requestId: string | null;
    method: string;
    pathname: string;
    searchParams: URLSearchParams;
    body: unknown;
    responseValue: unknown;
    routeParams: Record<string, string>;
    profile: UserWithRoles | null | undefined;
    statusCode: number;
    startTime: number | null;
    ip: string;
    userAgent: string | null;
    auditMeta: AuditRequestMeta;
    skip: boolean;
};

function sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== "object" || Array.isArray(body)) return body;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            result[key] = "[REDACTED]";
        } else if (typeof val === "string" && val.length > 500) {
            result[key] = val.substring(0, 500) + "...[truncated]";
        } else if (typeof val === "object") {
            result[key] = sanitizeBody(val);
        } else {
            result[key] = val;
        }
    }
    return result;
}

function sanitizeResponseBody(body: unknown, maxSize: number = 2000): unknown {
    if (!body) return null;
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    if (bodyStr.length > maxSize) {
        return bodyStr.substring(0, maxSize) + "...[truncated]";
    }
    try {
        return typeof body === "object" ? body : JSON.parse(bodyStr);
    } catch {
        return bodyStr;
    }
}

function deriveAction(method: string, pathname: string): string {
    const methodMap: Record<string, string> = {
        GET: "list",
        POST: "create",
        PUT: "update",
        PATCH: "patch",
        DELETE: "delete"
    };
    const parts = pathname.split("/").filter(s => s && !s.match(/^[0-9a-f-]{36}$/) && !s.match(/^[0-9]+$/));
    const resource = parts.pop() ?? "unknown";
    return `${methodMap[method] ?? method.toLowerCase()}-${resource}`;
}

function getUserRole(profile: UserWithRoles | null | undefined): string | null {
    if (!profile?.userRoles || profile.userRoles.length === 0) {
        return null;
    }
    return profile.userRoles[0]?.role?.name ?? null;
}

function resolveAuditMeta(request: RequestWithAuditMeta): AuditRequestMeta {
    return request.__auditMeta ?? {};
}

/**
 * B1: persistAuditLog là async vì shouldLog (B4) là async.
 * Hàm này được gọi trong void promise chain — không block response.
 */
async function persistAuditLog(entry: AuditLogEntry): Promise<void> {
    if (entry.module && entry.eventType && !await shouldLog(entry.module, entry.eventType)) {
        return;
    }

    db.insert(apiAuditLogs).values({
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
        summaryKey: entry.summaryKey ?? null,
        summaryParams: entry.summaryParams ?? null,
        sourceLogId: entry.sourceLogId,
        statusCode: entry.statusCode,
        responseTime: entry.responseTime,
        ip: entry.ip,
        userAgent: entry.userAgent,
        requestBody: entry.requestBody ?? null,
        responseBody: entry.responseBody ?? null,
        error: entry.error ?? null,
    }).catch((err) => {
        logApi.error({ err }, "[AUDIT] Failed to persist audit log");
    });
}

export function createAuditLogPlugin(options: AuditLogOptions = {}) {
    const {
        logResponseBody = false,
        logResponseBodyOnError = true,
        maxResponseBodySize = 2000,
    } = options;

    return new Elysia({ name: "plAuditLog" })
        .onBeforeHandle({ as: "scoped" }, (ctx) => {
            const body = (ctx as any).body;
            if (body) {
                const reqWithMeta = ctx.request as RequestWithAuditMeta;
                reqWithMeta.__body = body;
            }
        })
        .onAfterHandle({ as: "scoped" }, (ctx) => {
            const { request, set } = ctx;
            const reqWithMeta = request as RequestWithAuditMeta & {
                __body?: unknown;
                __requestId?: string;
                __startTime?: number;
            };

            if (reqWithMeta.__auditMeta?.skip) {
                return;
            }

            // B1: Snapshot đồng bộ tất cả field cần thiết TRƯỚC khi async enrich.
            // Không truy cập ctx sau đây trong async chain — ctx có thể bị GC.
            const url = new URL(request.url);
            const statusCode = typeof set.status === "number"
                ? set.status
                : typeof set.status === "string" && /^\d+$/.test(set.status)
                ? Number(set.status)
                : 200;

            const snapshot: AuditSnapshot = {
                requestId: reqWithMeta.__requestId ?? null,
                method: request.method,
                pathname: url.pathname,
                searchParams: url.searchParams,
                body: reqWithMeta.__body ?? (ctx as any).body ?? null,
                responseValue: (ctx as any).responseValue ?? (ctx as any).response ?? null,
                routeParams: ((ctx as any).params ?? {}) as Record<string, string>,
                profile: (ctx as any).profile,
                statusCode,
                startTime: reqWithMeta.__startTime ?? null,
                ip: resolveClientIp(request) ?? "",

                userAgent: request.headers.get("user-agent") ?? null,
                auditMeta: resolveAuditMeta(reqWithMeta),
                skip: false,
            };

            // B1: Toàn bộ enrich + persist là void promise — không block response.
            // Audit có thể mất nếu process crash trước khi promise chạy xong.
            // Đây là trade-off đã được business sign-off (2026-08-24).
            void (async () => {
                try {
                    await processAuditSnapshot(snapshot, logResponseBody, logResponseBodyOnError, maxResponseBodySize);
                } catch (err) {
                    logApi.error({ err }, "[AUDIT] Async enrich pipeline failed");
                }
            })();
        });
}

/**
 * B1: Xử lý enrich + persist trong async context, hoàn toàn tách khỏi request lifecycle.
 */
async function processAuditSnapshot(
    snapshot: AuditSnapshot,
    logResponseBody: boolean,
    logResponseBodyOnError: boolean,
    maxResponseBodySize: number,
): Promise<void> {
    const pathDerived = deriveAuditFromPath(snapshot.method, snapshot.pathname);

    let routeAudit = null;
    if (snapshot.statusCode < 400) {
        try {
            routeAudit = await resolveRouteAudit({
                method: snapshot.method,
                pathname: snapshot.pathname,
                params: snapshot.routeParams,
                body: snapshot.body,
                response: snapshot.responseValue,
                profileId: snapshot.profile?.id ?? null,
            });
        } catch (err) {
            logApi.error({ err }, "[AUDIT] resolveRouteAudit failed");
        }
    }

    const module = normalizeAuditModule(
        routeAudit?.module
            ?? snapshot.auditMeta.module
            ?? pathDerived.module
            ?? resolveModuleFromPath(snapshot.pathname),
    );
    const eventType = routeAudit?.eventType
        ?? snapshot.auditMeta.eventType
        ?? pathDerived.eventType
        ?? resolveEventTypeFromMethod(snapshot.method);
    const action = routeAudit
        ? `${routeAudit.eventType}-${routeAudit.module}`
        : (snapshot.auditMeta as any).__auditAction
        ?? (snapshot.auditMeta as any).action
        ?? deriveAction(snapshot.method, snapshot.pathname);

    const details = snapshot.auditMeta.details ?? routeAudit?.details ?? null;
    const responseTime = snapshot.startTime
        ? Math.round(performance.now() - snapshot.startTime)
        : null;

    const entry: AuditLogEntry = {
        requestId: snapshot.requestId,
        timestamp: new Date().toISOString(),
        userId: snapshot.profile?.id ?? null,
        userRole: getUserRole(snapshot.profile),
        method: snapshot.method,
        path: snapshot.pathname,
        query: snapshot.searchParams.size > 0
            ? Object.fromEntries(snapshot.searchParams)
            : null,
        action,
        module,
        eventType,
        entityType: snapshot.auditMeta.entityType ?? routeAudit?.entityType ?? null,
        entityId: snapshot.auditMeta.entityId ?? routeAudit?.entityId ?? null,
        entityLabel: snapshot.auditMeta.entityLabel ?? routeAudit?.entityLabel ?? null,
        summary: snapshot.auditMeta.summary
            ?? routeAudit?.summary
            ?? pathDerived.summary,
        summaryKey: routeAudit?.summaryKey ?? null,
        summaryParams: routeAudit?.summaryParams ?? null,
        sourceLogId: snapshot.auditMeta.sourceLogId ?? null,
        statusCode: snapshot.statusCode,
        responseTime,
        ip: snapshot.ip,
        userAgent: snapshot.userAgent,
    };

    if (details) {
        entry.requestBody = sanitizeBody(details) as Record<string, unknown>;
    } else if (MUTATING_METHODS.has(snapshot.method) && snapshot.body) {
        entry.requestBody = sanitizeBody(snapshot.body);
    }

    if (snapshot.statusCode >= 400) {
        const res = snapshot.responseValue as { summary?: string; message?: string } | undefined;
        entry.error = res?.summary ?? res?.message ?? null;
        if (logResponseBodyOnError && snapshot.responseValue) {
            entry.responseBody = sanitizeResponseBody(snapshot.responseValue, maxResponseBodySize);
        }
    } else if (logResponseBody && snapshot.responseValue) {
        entry.responseBody = sanitizeResponseBody(snapshot.responseValue, maxResponseBodySize);
    }

    if (eventType === "view" && snapshot.statusCode < 400) {
        scheduleViewAuditLog(entry);
    } else {
        await persistAuditLog(entry);
    }
}

export const plAuditLog = createAuditLogPlugin();
