import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { RoleService as service } from "./role-service.ts";
import { createRoleBodySchema, updateRoleBodySchema, updateRolePermissionsBodySchema } from "./types.ts";

const tags = ["Admin", "Roles"];

export function createRoleAdminRouter(basePath: string = "/roles") {
    const app = new Elysia({
        name: "roleAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.ROLES_READ);
            const items = await service.list();
            return { items };
        },
        {
            detail: {
                tags,
                summary: "List roles",
                description: "Returns all active roles with parsed rules.",
            },
        },
    );

    app.get(
        "/:id/permissions",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.ROLES_READ);
            const record = await service.getPermissions(params.id);
            return { record };
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get role permissions",
                description: "Returns permission rules and catalog entries granted to this role.",
            },
        },
    );

    app.put(
        "/:id/permissions",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.ROLES_MANAGE);
            const record = await service.updatePermissions(params.id, body);
            return { record, status: "updated" };
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: updateRolePermissionsBodySchema,
            detail: {
                tags,
                summary: "Update role permissions",
                description: "Updates only permission rules (permissions and restrictions) without changing role name or description.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.ROLES_READ);
            const record = await service.get(params.id);
            return { record };
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get role by ID",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.ROLES_MANAGE);
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        {
            body: createRoleBodySchema,
            detail: {
                tags,
                summary: "Create role",
                description: "Creates a custom role with id, name, and description. Permissions are configured separately via PUT /:id/permissions.",
            },
        },
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.ROLES_MANAGE);
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: updateRoleBodySchema,
            detail: {
                tags,
                summary: "Update role",
                description: "Updates role name, description, or permission rules.",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.ROLES_MANAGE);
            const record = await service.delete(params.id);
            return { record, status: "deleted" };
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Delete role",
                description: "Soft-deletes a non-base role that has no active user assignments.",
            },
        },
    );

    return app;
}
