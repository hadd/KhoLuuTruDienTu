import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { AuditLogService as service } from "./audit-log-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";

export function createAuditLogAdminRouter(basePath: string = "/audit-logs") {
    const meta = service.getMetadata?.();
    const tags = [["Admin", "Audit Log", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });
    const adminRoles = ["admin"];

    const app = new Elysia({
        name: "auditLogAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.urlQuery);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.get(params.id);
            return { record };
        },
        {
            ...docs.get,
            params: t.Object({ id: IdParam("Audit Log ID") }),
        },
    );

    return app;
}
