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
                summary: "Create a group with editors and QC members",
                description:
                    "Creates a group with editors and ordered QC members (qcIds[0]=qc1=leader). qcIds length must equal roundNumber. Group ID is auto-generated from name if not provided.",
            },
        },
    );

    app.get(
        "/",
        async ({ profile }) => {
            const isAdmin = authHelper.hasRoleAny(profile, adminRoles);
            return await service.list(
                isAdmin ? undefined : { memberUserId: profile.id },
            );
        },
        {
            detail: {
                tags,
                summary: "List active groups",
                description:
                    "Admin sees all non-deleted groups. Other users see only groups they belong to (active membership). Each group includes editors, QC members (qc1–qcN), and leader.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            const isAdmin = authHelper.hasRoleAny(profile, adminRoles);
            return await service.get(
                params.id,
                isAdmin ? undefined : { memberUserId: profile.id },
            );
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get group by ID",
                description:
                    "Admin can view any active group. Other users can only view groups they belong to (active membership).",
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
                    "Updates group info and optionally replaces editors and/or QC list. qcIds is required when changing roundNumber.",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            const isAdmin = authHelper.hasRoleAny(profile, adminRoles);
            return await service.delete(params.id, {
                actorUserId: profile.id,
                isAdmin,
            });
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Delete a group",
                description:
                    "Soft-deletes the group and expires all active memberships. Only admin or the group leader can delete.",
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
                summary: "Assign dossiers to group editors and QC by folder",
                description:
                    "Marks all targeted dossiers with assignedGroupId, sets requiredQcCount, distributes MAKER assignments round-robin (up to dossiersPerEditor per editor), pre-assigns CHECKER roles, and returns queueSummary (queued vs active).",
            },
        },
    );

    app.post(
        "/:id/assign-by-folder/continue",
        async ({ params, body, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.continueAssignByFolder(params.id, body, profile.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: assignByFolderToGroupBodySchema,
            detail: {
                tags,
                summary: "Continue group folder assignment from queue",
                description:
                    "Assigns queued dossiers (assignedGroupId set, no active group MAKER) to editors who have free slots (dossiersPerEditor minus in-progress count). Returns 409 if no editor has finished their current assignments.",
            },
        },
    );

    app.get(
        "/:id/folder-queue",
        async ({ params, query, profile }) => {
            authHelper.checkRoleAny(profile, adminRoles);
            return await service.getFolderQueue(params.id, query.folderId);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            query: t.Object({
                folderId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "List queued and active dossiers for a group folder pool",
                description:
                    "Returns dossiers in the folder subtree with assignedGroupId matching the group: queued (no active group MAKER) and activeByEditor.",
            },
        },
    );

    return app;
}
