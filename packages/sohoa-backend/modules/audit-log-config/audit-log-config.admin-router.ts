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
        .get(
            "/",
            async ({ profile }) => {
                authHelper.checkPermission(profile, Permission.AUDIT_LOGS_CONFIG);
                return await service.getGroupedConfig();
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
                return await service.updateToggles(body.items);
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
        )
        .put(
            "/settings",
            async ({ profile, body }) => {
                authHelper.checkPermission(profile, Permission.AUDIT_LOGS_CONFIG);
                const record = await service.updateSettings(body);
                return { record };
            },
            {
                body: t.Object({
                    retentionDays: t.Number({ minimum: 1, maximum: 3650 }),
                    purgeEnabled: t.Boolean(),
                }),
                detail: {
                    tags,
                    summary: "Update audit log retention settings",
                },
            },
        );
}
