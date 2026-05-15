import { Elysia, t } from "elysia";
import { IdParam, httpError } from "@shared/common-lib";
import { ProfileService as service, stripProfileSecrets } from "./profile-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { isNull } from "drizzle-orm";
import { createUserProfileWithRoleSchema } from "../../db/schemas/user_profile.ts";

export function createProfileAdminRouter(basePath: string = "/users") {
    const meta = service.getMetadata?.();
    const tags = [["Admin Profiles", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });
    const adminRoles = ["admin"];

    const app = new Elysia({
        name: "profileAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        // .use(plugins.urlQuery)
        // .use(plugins.auditLog);

    // app.get(
    //     "/",
    //     async ({ urlQuery = {} }) => {
    //         // authHelper.checkRoleAny(profile, adminRoles);
    //         return await service.getUsersWithRoles(urlQuery);
    //     },
    //     docs.list,
    // );

    app.get(
        "/all",
        async () => {
            const result = await service.getAllActiveUsers();
            return result;
        },
        {
            ...docs.list,
            detail: {
                tags,
                summary: "Get all users",
                description: "Returns all users where deletedAt is null.",
            },
            response: {
                200: t.Object({
                    items: t.Array(t.Any()),
                    page: t.Optional(t.Number()),
                    totalPages: t.Optional(t.Number()),
                    limit: t.Optional(t.Number()),
                    total: t.Optional(t.Number()),
                    hasNextPage: t.Optional(t.Boolean()),
                    hasPreviousPage: t.Optional(t.Boolean()),
                }),
            },
        },
    );

    app.get(
        "/:id",
        async ({ params }) => {
            // authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.get(params.id, {
                with: {
                    userRoles: {
                        where: isNull(userRoles.expiredAt),
                        with: {
                            role: true,
                        },
                    },
                },
            });
            return { record: stripProfileSecrets(record as { passwordHash?: string | null }) };
        },
        {
            ...docs.get,
            params: t.Object({ id: IdParam("User ID") }),
        },
    );

    app.post(
        "/",
        async ({ body, set }) => {
            // authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.createUserWithRole(body);
            set.status = 201;
            return { record, status: "created" };
        },
        {
            body: createUserProfileWithRoleSchema,
            response: {
                201: t.Object({
                    record: t.Any(),
                    status: t.String(),
                }),
            },
            detail: {
                tags,
                summary: "Create user with admin role",
                description:
                    "Creates a new user profile with password hash and assigns the admin role.",
            },
        },
    );

    app.put(
        "/:id",
        async ({ params, body }) => {
            // authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        {
        ...docs.update,
        detail: {
            tags,
            summary: "Update user",
            description: "Edit information of user",
        },
    }
    );

    app.delete(
        "/:id",
        async ({ params }) => {
            // authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.deleteUser(params.id);
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
            detail: {
                tags,
                summary: "Delete user",
                description: "Delete User",
            },
            params: t.Object({ id: IdParam("User ID") }),
            response: {
                200: t.Object({
                    record: t.Any(),
                    status: t.String(),
                }),
            },
        },
    );

    app.delete(
        "/:id/roles/:roleId",
        async ({ params }) => {
            // authHelper.checkRoleAny(profile, adminRoles);
            const { id, roleId } = params;
            const record = await service.removeRole(id, roleId);
            return { record, status: "removed" };
        },
        {
            params: t.Object({
                id: IdParam("User ID"),
                roleId: t.String(),
            }),
            response: {
                200: t.Object({
                    record: t.Any(),
                    status: t.String(),
                }),
            },
            detail: {
                tags,
                summary: "Remove role from user",
                description:
                    "Removes a role assignment by setting expiredAt.",
            },
        },
    );

    app.put(
        "/:id/reset-password",
        async ({ params, body }) => {
            // authHelper.checkRoleAny(profile, adminRoles);
            const { id } = params;
            const { password } = body as { password: string };
            const result = await service.resetPassword(id, password);
            return result;
        },
        {
            params: t.Object({
                id: IdParam("User ID"),
            }),
            body: t.Object({
                password: t.String({ minLength: 6 }),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                    message: t.String(),
                }),
            },
            detail: {
                tags,
                summary: "Reset user password",
                description:
                    "Resets a user's password. Revokes active sessions. Admin role required.",
            },
        },
    );

    app.get(
        "/template",
        async ({ set }) => {
            const buffer = await service.downloadTemplateExcel();
            set.headers["Content-Disposition"] = "attachment; filename=\"user-import-template.xlsx\"";
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            return buffer;
        },
        {
            detail: {
                tags,
                summary: "Download user import template",
                description: "Downloads an Excel template file for importing users.",
            },
        },
    );

    app.get(
        "/export",
        async ({ set }) => {
            const buffer = await service.exportUsersExcel();
            set.headers["Content-Disposition"] = "attachment; filename=\"users-export.xlsx\"";
            set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            return buffer;
        },
        {
            detail: {
                tags,
                summary: "Export users to Excel",
                description: "Exports all active users to an Excel file.",
            },
        },
    );

    app.post(
        "/import",
        async ({ body, set }) => {
            const file = body.file as { raw?: Uint8Array | null };
            if (!file?.raw) {
                throw httpError.badRequest("No file uploaded");
            }
            const result = await service.importUsersExcel(file.raw);
            set.status = 200;
            return result;
        },
        {
            body: t.Object({
                file: t.File(),
            }),
            response: {
                200: t.Object({
                    success: t.Number(),
                    failed: t.Number(),
                    errors: t.Array(t.String()),
                }),
            },
            detail: {
                tags,
                summary: "Import users from Excel",
                description: "Imports users from an Excel file. Email must be unique.",
            },
        },
    );

    return app;
}
