import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ArchiveAssignmentService } from "./archive-assignment-service.ts";

export function createArchiveAssignmentAdminRouter(
    basePath: string = "/archive-assignments",
) {
    const tags = ["Admin", "ArchivePermission"];

    return new Elysia({ name: "archiveAssignmentAdminRouter", prefix: basePath })
        .use(plugins.authProfile)
        .get("/users/:userId", async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAssignmentService.getUserAssignments(params.userId);
        }, {
            params: t.Object({ userId: IdParam("User ID") }),
            detail: { tags, summary: "Get archive assignments for user" },
        })
        .put("/users/:userId", async ({ profile, params, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAssignmentService.replaceUserAssignments(
                params.userId,
                body.assignments,
                profile.id,
            );
        }, {
            params: t.Object({ userId: IdParam("User ID") }),
            body: t.Object({
                assignments: t.Array(t.Object({
                    configId: t.String({ format: "uuid" }),
                    slotCode: t.String({ minLength: 1 }),
                    fondIds: t.Array(t.String()),
                })),
            }),
            detail: { tags, summary: "Replace archive assignments for user" },
        })
        .get("/groups/:groupId", async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAssignmentService.getGroupBinding(params.groupId);
        }, {
            params: t.Object({ groupId: t.String({ minLength: 1 }) }),
            detail: { tags, summary: "Get archive binding for group" },
        })
        .put("/groups/:groupId", async ({ profile, params, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_PERMISSIONS_MANAGE);
            return ArchiveAssignmentService.upsertGroupBinding(params.groupId, body);
        }, {
            params: t.Object({ groupId: t.String({ minLength: 1 }) }),
            body: t.Object({
                configId: t.String({ format: "uuid" }),
                fondIds: t.Optional(t.Array(t.String())),
            }),
            detail: { tags, summary: "Upsert archive binding for group" },
        })
        .put("/groups/:groupId/members/:memberId/slot", async ({ profile, params, body }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_MANAGE_MEMBERS);
            return ArchiveAssignmentService.setMemberArchiveSlot(
                params.groupId,
                params.memberId,
                body.archivePermissionSlotCode,
            );
        }, {
            params: t.Object({
                groupId: t.String({ minLength: 1 }),
                memberId: IdParam("Member ID"),
            }),
            body: t.Object({
                archivePermissionSlotCode: t.Nullable(t.String()),
            }),
            detail: { tags, summary: "Set archive permission slot for group member" },
        });
}
