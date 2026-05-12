import { Elysia } from "elysia";
import { logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { apiAuditLogs } from "../../db/schemas/api-audit-log.ts";
import type { UserWithRoles } from "./auth-profile.ts";

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "apikey", "otp", "pin", "authorization"]);
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

interface RequestWithMetadata extends Request {
    __requestId?: string;
    __startTime?: number;
    __body?: unknown;
}

function persistAuditLog(entry: AuditLogEntry): void {
    db.insert(apiAuditLogs).values({
        requestId: entry.requestId,
        userId: entry.userId,
        userRole: entry.userRole,
        method: entry.method,
        path: entry.path,
        query: entry.query,
        action: entry.action,
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
                const reqWithMeta = ctx.request as RequestWithMetadata;
                reqWithMeta.__body = body;
            }
        })
        .onAfterHandle({ as: "scoped" }, (ctx) => {
            const { request, set } = ctx;
            const profile = (ctx as any).profile;
            const reqWithMeta = request as RequestWithMetadata;
            const body = reqWithMeta.__body ?? (ctx as any).body ?? null;
            const responseValue = (ctx as any).responseValue;

            const url = new URL(request.url);
            const statusCode = typeof set.status === "number" ? set.status : 200;
            const responseTime = reqWithMeta.__startTime
                ? Math.round(performance.now() - reqWithMeta.__startTime)
                : null;

            const entry: AuditLogEntry = {
                requestId: reqWithMeta.__requestId ?? null,
                timestamp: new Date().toISOString(),
                userId: profile?.id ?? null,
                userRole: getUserRole(profile),
                method: request.method,
                path: url.pathname,
                query: url.search ? Object.fromEntries(url.searchParams) : null,
                action: deriveAction(request.method, url.pathname),
                statusCode,
                responseTime,
                ip: request.headers.get("x-forwarded-for")
                    ?? request.headers.get("cf-connecting-ip")
                    ?? null,
                userAgent: request.headers.get("user-agent") ?? null,
            };

            if (MUTATING_METHODS.has(request.method) && body) {
                entry.requestBody = sanitizeBody(body);
            }

            if (statusCode >= 400) {
                const res = responseValue as { summary?: string; message?: string } | undefined;
                entry.error = res?.summary ?? res?.message ?? null;

                if (logResponseBodyOnError && responseValue) {
                    entry.responseBody = sanitizeResponseBody(responseValue, maxResponseBodySize);
                }
            } else if (logResponseBody && responseValue) {
                entry.responseBody = sanitizeResponseBody(responseValue, maxResponseBodySize);
            }
            persistAuditLog(entry);
        });
}

export const plAuditLog = createAuditLogPlugin();
