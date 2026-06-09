import { Elysia, t } from "elysia";
import { GroupService as service } from "./group-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    assignByFolderToGroupBodySchema,
    createGroupBodySchema,
    fieldTemplateBodySchema,
    syncQcWorkflowBodySchema,
    updateGroupBodySchema,
} from "./types.ts";
import { buildMetadataSchemaResponse } from "../../libs/metadata-schema.ts";

export function createGroupAdminRouter(basePath: string = "/groups") {
    const tags = ["Admin", "Group"];

    const app = new Elysia({
        name: "groupAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/metadata-schema",
        ({ profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            return buildMetadataSchemaResponse();
        },
        {
            detail: {
                tags,
                summary: "Get static metadata field schema",
                description:
                    "Returns the fixed list of metadata groups and fields used for field-level ACL configuration. Dynamic groups use _N_ as a placeholder for numbered variants.",
            },
        },
    );

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
                    "Creates a group with editors and ordered QC members (qcIds[0]=qc1=leader). qcIds length must equal roundNumber. Group ID is auto-generated from name if not provided.",
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
                    "Users with group management permissions see all non-deleted groups. Others with groups.read see only groups they belong to.",
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
                    "Updates group info and optionally replaces editors and/or QC list. qcIds is required when changing roundNumber.",
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
        "/:id/field-template",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_UPDATE);
            return await service.setFieldTemplate(params.id, body);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            body: fieldTemplateBodySchema,
            detail: {
                tags,
                summary: "Set field-level ACL template for group editors",
                description:
                    "Assigns allowed metadata field patterns to each editor in the group. Validates that every metadata group is covered by exactly one editor (no gaps, no overlaps). Saves templates to group_members.allowed_fields for use during assign-by-folder.",
            },
        },
    );

    app.get(
        "/:id/field-template",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            return await service.getFieldTemplate(params.id);
        },
        {
            params: t.Object({ id: t.String({ minLength: 1 }) }),
            detail: {
                tags,
                summary: "Get current field-level ACL template for group editors",
                description:
                    "Returns the current allowedFields configuration per editor in the group.",
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
