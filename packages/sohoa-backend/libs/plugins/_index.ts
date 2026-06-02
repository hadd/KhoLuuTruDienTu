import { plAuthProfile } from "./auth-profile.ts";
import { plPermissionAny } from "./permission-require.ts";
import { plUrlQuery } from "./url-query.ts";
import { plAuthInternalApi } from "./auth-internal-api.ts";
import { plAuthMinioWebhook } from "./auth-minio-webhook.ts";
import { plAuditLog, createAuditLogPlugin } from "./audit-log.ts";
export type { AuditLogEntry, AuditLogOptions } from "./audit-log.ts";

export const plugins = {
    authProfile: plAuthProfile,
    permissionAny: plPermissionAny,
    urlQuery: plUrlQuery,
    authInternalApi: plAuthInternalApi,
    authMinioWebhook: plAuthMinioWebhook,
    auditLog: plAuditLog,
    createAuditLogPlugin,
};
