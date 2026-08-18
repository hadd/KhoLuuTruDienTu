import { Elysia, t, type Static } from "elysia";
import { IdParam, httpError } from "@shared/common-lib";
import { ProfileService as service, stripProfileSecrets } from "./profile-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import { isNull } from "drizzle-orm";
import {
    createUserProfileWithRoleSchema,
    patchUserStatusSchema,
    permanentDeleteUsersSchema,
    updateUserProfileWithRoleSchema,
} from "../../db/schemas/user_profile.ts";


export function createProfileAdminRouter(basePath: string = "/users") {
    const meta = service.getMetadata?.();
    const tags = [["Admin Profiles", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });
    const app = new Elysia({
        name: "profileAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.urlQuery)
        .use(plugins.auditLog);

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
        async ({ profile, urlQuery = {} }) => {
            authHelper.checkPermission(profile, Permission.USERS_READ);
            return await service.getAllActiveUsers(urlQuery, profile);
        },
        {
            ...docs.list,
            detail: {
                tags,
                summary: "Get all users",
                description:
                    "Returns users where deletedAt is null. Supports page, limit (max 400), search, sort, and filter query params.",
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
        "/roles",
        async ({ profile }) => {
            const record = await service.getAllRoles(profile);
            return { record };
        },
        {
            detail: {
                tags,
                summary: "Get all roles",
                description: "Returns all active roles with user assignments.",
            },
            response: {
                200: t.Object({
                    record: t.Array(t.Any()),
                }),
            },
        },
    );

    app.get(
        "/by-permission/:permission",
        async ({ params, profile }) => {
            return await service.getUsersByPermission(params.permission, profile);
        },
        {
            params: t.Object({
                permission: t.String(),
            }),
            detail: {
                tags,
                summary: "Get users by permission",
                description:
                    "Returns active users (active=true, not deleted) whose active role grants the given permission key (e.g. data-entry.maker).",
            },
            response: {
                200: t.Object({
                    items: t.Array(t.Any()),
                    total: t.Number(),
                }),
            },
        },
    );

    const permanentDeleteRoute = {
        body: permanentDeleteUsersSchema,
        detail: {
            tags,
            summary: "Permanently delete multiple users",
            description:
                "Hard-deletes user_profiles and user_roles rows for the given IDs. Also removes group_members, dossier_assignments, and project_progress_histories that reference those users.",
        },
        response: {
            200: t.Object({
                deletedIds: t.Array(t.String()),
                notFoundIds: t.Array(t.String()),
                status: t.String(),
            }),
        },
    } as const;

    const handlePermanentDelete = async ({
        body,
        profile,
    }: {
        body: Static<typeof permanentDeleteUsersSchema>;
        profile: Parameters<typeof authHelper.checkPermission>[0];
    }) => {
        authHelper.checkPermission(profile, Permission.USERS_DELETE);
        const result = await service.permanentDeleteUsers(body);
        return { ...result, status: "permanently_deleted" };
    };

    app.post("/permanent-delete", handlePermanentDelete, permanentDeleteRoute);
    app.delete("/permanent-delete", handlePermanentDelete, permanentDeleteRoute);

    app.get(
        "/:id",
        async ({ params }) => {
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
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.USERS_CREATE);
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
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.USERS_UPDATE);
            const record = await service.updateUserWithRole(params.id, body);
            return { record, status: "updated" };
        },
        {
            body: updateUserProfileWithRoleSchema,
            detail: {
                tags,
                summary: "Update user",
                description:
                    "Edit user information including role. Optional password (min 8 chars) revokes active sessions when changed.",
            },
            response: {
                200: t.Object({
                    record: t.Any(),
                    status: t.String(),
                }),
            },
        }
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.USERS_DELETE);
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
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.USERS_UPDATE);
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

    app.patch(
        "/:id/status",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.USERS_UPDATE);
            const record = await service.patchUserStatus(params.id, body);
            return { record, status: "patched" };
        },
        {
            body: patchUserStatusSchema,
            detail: {
                tags,
                summary: "Update user active status",
                description: "Patch user active/inactive status.",
            },
            response: {
                200: t.Object({
                    record: t.Any(),
                    status: t.String(),
                }),
            },
        },
    );

    app.put(
        "/:id/reset-password",
        async ({ params, body }) => {
            const { id } = params;
            const { currentPassword, newPassword } = body as {
                currentPassword: string;
                newPassword: string;
            };
            const result = await service.resetPassword(id, currentPassword, newPassword);
            return result;
        },
        {
            params: t.Object({
                id: IdParam("User ID"),
            }),
            body: t.Object({
                currentPassword: t.String({ minLength: 1 }),
                newPassword: t.String({ minLength: 6 }),
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
                    "Resets a user's password after verifying the current password. Revokes active sessions.",
            },
        },
    );

    app.get(
        "/template",
        async ({ profile, set }) => {
            authHelper.checkPermission(profile, Permission.USERS_IMPORT);
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
        async ({ profile, set }) => {
            authHelper.checkPermission(profile, Permission.USERS_EXPORT);
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
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.USERS_IMPORT);
            const file = body.file as File | undefined;
            if (!file) {
                throw httpError.badRequest("Chưa tải lên file Excel");
            }

            // Read file content from the File object
            const arrayBuffer = await file.arrayBuffer();
            const fileBuffer = new Uint8Array(arrayBuffer);

            const result = await service.importUsersExcel(fileBuffer);

            // If there are validation errors, return the error Excel file directly
            if (result.errorFile) {
                set.headers["Content-Disposition"] = 'attachment; filename="import-errors.xlsx"';
                set.headers["Content-Type"] =
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                set.status = 200;
                return result.errorFile;
            }

            set.status = 200;
            return {
                success: result.success,
                failed: result.failed,
                successCount: result.successCount,
                failedCount: result.failedCount,
                errors: result.errors,
            };
        },
        {
            body: t.Object({
                file: t.File(),
            }),
            response: {
                200: t.Any(),
            },
            detail: {
                tags,
                summary: "Import users from Excel",
                description:
                    "Imports users from Excel. If there are validation errors, returns an error Excel file directly. Otherwise returns JSON summary.",
            },
        },
    );

    return app;
}
