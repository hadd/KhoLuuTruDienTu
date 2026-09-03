import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { AuditLogConfigService as service } from "./audit-log-config-service.ts";

export function createAuditLogConfigAdminRouter(basePath: string = "/audit-log-config") {
    const tags = ["Admin", "Audit Log Config"];

    return new Elysia({
        name: "auditLogConfigAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog)
        .get(
            "/",
            async ({ profile }) => {
                authHelper.checkPermission(profile, Permission.AUDIT_LOGS_CONFIG);
                return await service.getGroupedConfig(profile);
            },
            {
                detail: {
                    tags,
                    summary: "Get audit log configuration",
                },
            },
        )
        .put(
            "/",
            async ({ profile, body }) => {
                authHelper.checkPermission(profile, Permission.AUDIT_LOGS_CONFIG);
                return await service.updateToggles(body.items, profile);
            },
            {
                body: t.Object({
                    items: t.Array(t.Object({
                        module: t.String(),
                        actionKey: t.String(),
                        enabled: t.Boolean(),
                    })),
                }),
                detail: {
                    tags,
                    summary: "Update audit log action toggles",
                },
            },
        );
}

