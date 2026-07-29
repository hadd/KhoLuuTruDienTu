import { logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { apiAuditLogs } from "../../db/schemas/api-audit-log.ts";
import { shouldLog } from "../audit-log-config/audit-log-config-cache.ts";

const SENSITIVE_KEYS = new Set(["password", "token", "secret", "apikey", "otp", "pin", "authorization"]);

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

export type AuditActivityInput = {
    userId?: string | null;
    userRole?: string | null;
    module: string;
    eventType: string;
    summary: string;
    entityType?: string | null;
    entityId?: string | null;
    sourceLogId?: string | null;
    requestId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    requestMeta?: {
        method?: string;
        path?: string;
        statusCode?: number;
        query?: Record<string, string> | null;
        requestBody?: unknown;
        responseBody?: unknown;
        error?: string | null;
        responseTime?: number | null;
        action?: string | null;
    };
};

export function logActivity(input: AuditActivityInput): void {
    if (!shouldLog(input.module, input.eventType)) {
        return;
    }

    const meta = input.requestMeta;
    db.insert(apiAuditLogs).values({
        requestId: input.requestId ?? null,
        userId: input.userId ?? null,
        userRole: input.userRole ?? null,
        method: meta?.method ?? "EVENT",
        path: meta?.path ?? `/${input.module}/${input.eventType}`,
        query: meta?.query ?? null,
        action: meta?.action ?? `${input.eventType}-${input.module}`,
        module: input.module,
        eventType: input.eventType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        sourceLogId: input.sourceLogId ?? null,
        statusCode: meta?.statusCode ?? 200,
        responseTime: meta?.responseTime ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestBody: meta?.requestBody ? sanitizeBody(meta.requestBody) as Record<string, unknown> : null,
        responseBody: meta?.responseBody ?? null,
        error: meta?.error ?? null,
    }).catch((err) => {
        logApi.error({ err }, "[AUDIT] Failed to persist activity log");
    });
}

export type AuditRequestMeta = {
    module?: string | null;
    eventType?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    summary?: string | null;
    sourceLogId?: string | null;
    details?: Record<string, unknown> | null;
    skip?: boolean;
};

export interface RequestWithAuditMeta extends Request {
    __auditMeta?: AuditRequestMeta;
    __auditAction?: string;
    __body?: unknown;
}

export function resolveEventTypeFromMethod(method: string): string {
    const map: Record<string, string> = {
        GET: "view",
        POST: "create",
        PUT: "update",
        PATCH: "update",
        DELETE: "delete",
    };
    return map[method] ?? method.toLowerCase();
}

const MODULE_PATH_ALIASES: Record<string, string> = {
    "archive-warehouse": "archive",
    "archive-submissions": "archive",
    "archive-submission": "archive",
};

const ADMIN_RESOURCE_ALIASES: Record<string, string> = {
    "users": "users",
    "roles": "roles",
    "permissions": "roles",
    "metadata-templates": "metadata",
    "metadata-permission-configs": "metadata",
    "metadata-export-presets": "metadata",
    "document-naming-configs": "metadata",
    "archive-field-config": "metadata",
    "groups": "groups",
    "projects": "projects",
    "issue-reports": "issue-reports",
    "archive-acl": "archive",
    "watermark": "watermark",
    "notification-configs": "notifications",
    "audit-logs": "audit-log",
    "audit-log-config": "audit-log-config",
};

export function normalizeAuditModule(module: string | null | undefined): string | null {
    if (!module) return null;
    const key = module.replace(/_/g, "-");
    return MODULE_PATH_ALIASES[key] ?? key;
}

function resolveAdminResourceModule(resource: string): string {
    return ADMIN_RESOURCE_ALIASES[resource] ?? resource;
}

export function resolveModuleFromPath(pathname: string): string | null {
    const segments = pathname.split("/").filter(Boolean);
    const apiIndex = segments.indexOf("api");
    const start = apiIndex >= 0 ? apiIndex + 2 : 0;

    if (segments[start] === "admin") {
        const adminResource = segments[start + 1];
        if (!adminResource) return "admin";
        return normalizeAuditModule(resolveAdminResourceModule(adminResource));
    }

    const resource = segments[start];
    if (!resource) return null;
    return normalizeAuditModule(resource);
}
