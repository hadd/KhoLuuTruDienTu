import { Elysia, t } from "elysia";
import { GroupService as service } from "./group-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    updateGroupBodySchema,
} from "./types.ts";

const adminRoles = ["admin"];

export function createGroupAdminRouter(basePath: string = "/groups") {
    const tags = ["Admin", "Group"];

    const app = new Elysia({
        name: "groupAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.create(body);
        },
        {
            body: createGroupBodySchema,
            detail: {
                tags,
                summary: "Create a group with editors",
                description:
                    "Creates a group with basic info and assigns editor members. Group ID is auto-generated from name if not provided.",
            },
        },
    );

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.list();
        },
        {
            detail: {
                tags,
                summary: "List all active groups",
                description: "Returns all non-deleted groups with their active editor members.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.get(params.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get group by ID",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.update(params.id, body);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: updateGroupBodySchema,
            detail: {
                tags,
                summary: "Update a group",
                description:
                    "Updates group info and optionally replaces the full editor list.",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.delete(params.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Delete a group",
                description: "Soft-deletes the group and expires all active memberships.",
            },
        },
    );

    app.post(
        "/:id/assign-by-folder",
        async ({ params, body, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.assignByFolder(params.id, body, profile.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: assignByFolderToGroupBodySchema,
            detail: {
                tags,
                summary: "Assign dossiers to group editors by folder",
                description:
                    "Finds dossiers in leaf folders under the given folder and distributes MAKER assignments round-robin, up to dossiersPerEditor per editor. Sets requiredQcCount from group roundNumber.",
            },
        },
    );

    return app;
}
