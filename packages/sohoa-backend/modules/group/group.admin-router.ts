import { Elysia, t } from "elysia";
import { GroupService as service } from "./group-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    metadataPermissionConfigBodySchema,
    permissionAssignmentsBodySchema,
    syncQcWorkflowBodySchema,
    updateGroupBodySchema,
} from "./types.ts";

export function createGroupAdminRouter(basePath: string = "/groups") {
    const tags = ["Admin", "Group"];

    const app = new Elysia({
        name: "groupAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_CREATE);
            return await service.create(body);
        },
        {
            body: createGroupBodySchema,
            detail: {
                tags,
                summary: "Create a group with editors and QC members",
                description:
                    "Creates a group with editors and QC members via qcLevels (multiple QC per level supported). leaderId: required when roundNumber=0; optional when roundNumber>0 and must be a QC level-1 member (defaults to first qc1). Group ID is auto-generated from name if not provided.",
            },
        },
    );

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            const canManageAll = authHelper.canManageAllGroups(profile);
            return await service.list(
                canManageAll ? undefined : { memberUserId: profile.id },
            );
        },
        {
            detail: {
                tags,
                summary: "List active groups",
                description:
                    "Users with group management permissions see all non-deleted groups. Others with groups.read see only groups they belong to. Each group includes permissionConfig and assignments when a metadata permission config is bound.",
            },
        },
    );

    app.get(
        "/available-editors",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            return await service.listUnassignedEditors();
        },
        {
            detail: {
                tags,
                summary: "List editors not in any group",
                description:
                    "Returns active users with editor role who are not active editor members of any non-deleted group.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            const canManageAll = authHelper.canManageAllGroups(profile);
            return await service.get(
                params.id,
                canManageAll ? undefined : { memberUserId: profile.id },
            );
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get group by ID",
                description:
                    "Users with group management permissions can view any active group. Others can only view groups they belong to.",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_UPDATE);
            return await service.update(params.id, body, profile.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: updateGroupBodySchema,
            detail: {
                tags,
                summary: "Update a group",
                description:
                    "Updates group info and optionally replaces editors and/or QC list via qcLevels. qcLevels required when changing roundNumber.",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            const canManageAll = authHelper.canManageAllGroups(profile);
            if (canManageAll) {
                authHelper.checkPermission(profile, Permission.GROUPS_DELETE);
            }
            return await service.delete(params.id, {
                actorUserId: profile.id,
                isAdmin: canManageAll,
            });
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Delete a group",
                description:
                    "Soft-deletes the group and expires all active memberships. Requires groups.delete; group leader may delete their own group.",
            },
        },
    );

    app.post(
        "/:id/assign-by-folder",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_START_WORKFLOW);
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
            authHelper.checkPermission(profile, Permission.GROUPS_START_WORKFLOW);
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

    app.post(
        "/:id/sync-qc-workflow",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_START_WORKFLOW);
            return await service.syncQcWorkflow(params.id, profile.id, body);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: syncQcWorkflowBodySchema,
            detail: {
                tags,
                summary: "Re-sync QC assignments and dossier statuses for a group",
                description:
                    "Runs syncGroupQcWorkflow to rebalance checker assignments and update dossier statuses after QC config changes. Optional folderId scopes to one folder.",
            },
        },
    );

    app.patch(
        "/:id/metadata-permission-config",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_UPDATE);
            return await service.bindMetadataPermissionConfig(
                params.id,
                body.permissionConfigId,
            );
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: metadataPermissionConfigBodySchema,
            detail: {
                tags,
                summary: "Bind metadata permission config to group",
                description:
                    "Sets metadata_permission_config_id on the group. Pass null to unbind.",
            },
        },
    );

    app.get(
        "/:id/metadata-permission",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            return await service.getMetadataPermission(params.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get group metadata permission config and slot assignments",
                description:
                    "Returns the bound permission config, slots, field catalog, and editors grouped by slot.",
            },
        },
    );

    app.put(
        "/:id/permission-assignments",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_UPDATE);
            return await service.setPermissionAssignments(params.id, body.assignments);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: permissionAssignmentsBodySchema,
            detail: {
                tags,
                summary: "Assign group editors to permission slots",
                description:
                    "Each editor appears in exactly one slot. Every slot must have at least one editor when config is active.",
            },
        },
    );

    app.get(
        "/:id/folder-queue",
        async ({ params, query, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_START_WORKFLOW);
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
