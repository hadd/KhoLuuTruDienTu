import { httpError } from "@shared/common-lib";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { groups } from "../../db/schemas/groups.ts";
import { projects } from "../../db/schemas/project.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { userRoles } from "../../db/schemas/user_role.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { Permission } from "./permission-catalog.ts";
import { userRolesHavePermission } from "./permission-resolver.ts";
import { AuthRole, authHelper } from "./auth-helper.ts";

export type ProjectAccessScope =
    | { type: "global" }
    | { type: "managed"; projectCodes: string[] };

export const projectAccessHelper = {
    isProjectManager(profile: UserWithRoles): boolean {
        return authHelper.hasRoleAny(profile, [AuthRole.PROJECT_MANAGER]);
    },

    isSystemAdmin(profile: UserWithRoles): boolean {
        return authHelper.hasRoleAny(profile, [AuthRole.ADMIN]);
    },

    /** System admin sees all projects; other roles only see projects they manage. */
    hasGlobalProjectScope(profile: UserWithRoles): boolean {
        return projectAccessHelper.isSystemAdmin(profile);
    },

    async resolveScope(profile: UserWithRoles): Promise<ProjectAccessScope> {
        if (projectAccessHelper.hasGlobalProjectScope(profile)) {
            return { type: "global" };
        }

        const projectCodes = await projectAccessHelper.getManagedProjectCodes(profile.id);
        return { type: "managed", projectCodes };
    },

    async getManagedProjectCodes(managerId: string): Promise<string[]> {
        const rows = await db.query.projects.findMany({
            where: and(
                eq(projects.managerId, managerId),
                isNull(projects.deletedAt),
            ),
            columns: { projectCode: true },
        });

        return rows.map((row) => row.projectCode);
    },

    async assertCanAccessProject(profile: UserWithRoles, projectCode: string): Promise<void> {
        const scope = await projectAccessHelper.resolveScope(profile);
        if (scope.type === "global") {
            return;
        }

        if (!scope.projectCodes.includes(projectCode)) {
            throw httpError.forbidden("You do not manage this project");
        }
    },

    async assertCanAccessGroup(profile: UserWithRoles, groupId: string): Promise<void> {
        const group = await db.query.groups.findFirst({
            where: and(
                eq(groups.id, groupId),
                isNull(groups.deletedAt),
            ),
            columns: { projectCode: true },
        });

        if (!group) {
            throw httpError.notFound("Group not found");
        }

        if (!group.projectCode) {
            if (projectAccessHelper.isProjectManager(profile)) {
                throw httpError.forbidden("Group is not linked to a project");
            }
            return;
        }

        await projectAccessHelper.assertCanAccessProject(profile, group.projectCode);
    },

    async assertValidProjectManager(managerId: string): Promise<void> {
        const user = await db.query.userProfiles.findFirst({
            where: and(
                eq(userProfiles.id, managerId),
                isNull(userProfiles.deletedAt),
            ),
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                    with: { role: true },
                },
            },
        });

        if (!user) {
            throw httpError.badRequest("Project manager user not found");
        }

        if (!user.active) {
            throw httpError.badRequest("Project manager user is inactive");
        }

        if (!userRolesHavePermission(user.userRoles, Permission.PROJECTS_READ)) {
            throw httpError.badRequest(
                `Assigned user must have permission ${Permission.PROJECTS_READ}`,
            );
        }
    },
};
