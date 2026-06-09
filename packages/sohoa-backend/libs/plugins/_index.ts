import { plAuthProfile } from "./auth-profile.ts";
import { plPermission, plPermissionAny, plPermissionsAny } from "./permission-require.ts";
import { plUrlQuery } from "./url-query.ts";
import { plAuthInternalApi } from "./auth-internal-api.ts";
import { plAuditLog, createAuditLogPlugin } from "./audit-log.ts";
export type { AuditLogEntry, AuditLogOptions } from "./audit-log.ts";

export const plugins = {
    authProfile: plAuthProfile,
    permissionAny: plPermissionAny,
    permission: plPermission,
    permissionsAny: plPermissionsAny,
    urlQuery: plUrlQuery,
    authInternalApi: plAuthInternalApi,
    auditLog: plAuditLog,
    createAuditLogPlugin,
};
