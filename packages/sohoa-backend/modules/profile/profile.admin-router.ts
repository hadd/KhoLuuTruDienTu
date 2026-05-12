import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
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
        .use(plugins.urlQuery)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.getUsersWithRoles(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
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
        async ({ body, set, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
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
            authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        docs.update,
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            const record = await service.deleteUser(params.id);
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
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
            authHelper.checkRoleAny(profile, adminRoles);
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
        async ({ params, body, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
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

    return app;
}
