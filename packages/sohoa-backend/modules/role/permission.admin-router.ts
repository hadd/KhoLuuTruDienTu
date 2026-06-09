import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { RoleService as service } from "./role-service.ts";

export function createPermissionAdminRouter(basePath: string = "/permissions") {
    return new Elysia({
        name: "permissionAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .get(
            "/",
            async ({ profile }) => {
                authHelper.checkPermission(profile, Permission.ROLES_READ);
                return { items: service.getPermissionCatalog() };
            },
            {
                detail: {
                    tags: ["Admin", "Permissions"],
                    summary: "List permission catalog",
                    description: "Returns all system permission keys with labels for the permission matrix UI.",
                },
            },
        );
}
