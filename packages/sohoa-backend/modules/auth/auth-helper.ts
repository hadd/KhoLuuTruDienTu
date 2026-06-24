import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    WORKABLE_ASSIGNMENT_STATUSES,
} from "../../db/schemas/workflow-constants.ts";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { Permission } from "./permission-catalog.ts";
import {
    hasAnyPermissionInRules,
    hasPermissionInRules,
    parseRoleRules,
    resolveEffectivePermissions,
    type RoleRules,
} from "./permission-resolver.ts";

export const AuthRole = {
    ADMIN: "admin",
    QC: "qc",
    EDITOR: "editor",
    PROJECT_MANAGER: "project_manager",
} as const;

/** @deprecated Use Permission.DATA_ENTRY_MAKER with checkPermission instead */
export const DATA_ENTRY_MAKER_PROFILE_ROLES = [
    AuthRole.ADMIN,
    AuthRole.EDITOR,
] as const;

/** @deprecated Use Permission.DATA_ENTRY_CHECKER with checkPermission instead */
export const DATA_ENTRY_QC_PROFILE_ROLES = [
    AuthRole.ADMIN,
    AuthRole.QC,
] as const;

function normalizeRoleKey(value: string): string {
    return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function roleMatches(role: { id: string; name: string }, requiredRole: string): boolean {
    const required = normalizeRoleKey(requiredRole);
    return normalizeRoleKey(role.id) === required
        || normalizeRoleKey(role.name) === required;
}

function profileHasAnyRole(profile: UserWithRoles, requiredRoles: readonly string[]): boolean {
    return requiredRoles.some((required) =>
        profile.userRoles.some((userRole) => roleMatches(userRole.role, required)),
    );
}

function getActiveRoleRules(profile: UserWithRoles): RoleRules {
    const activeRole = profile.userRoles[0]?.role;
    if (!activeRole) {
        return { permissions: [], restrictions: [] };
    }
    return parseRoleRules(activeRole.rules);
}

async function hasActiveDossierAssignment(
    profile: UserWithRoles,
    workerRoles: readonly string[],
    dossierId: string,
): Promise<boolean> {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, profile.id),
            inArray(dossierAssignments.role, [...workerRoles] as never),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { id: true },
    });

    return Boolean(assignment);
}

async function hasActiveAssignmentById(
    profile: UserWithRoles,
    workerRoles: readonly string[],
    assignmentId: string,
): Promise<boolean> {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.id, assignmentId),
            eq(dossierAssignments.assigneeId, profile.id),
            inArray(dossierAssignments.role, [...workerRoles] as never),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { id: true },
    });

    return Boolean(assignment);
}

function assertProfile(profile: UserWithRoles | null | undefined): asserts profile is UserWithRoles {
    if (!profile) {
        throw httpError.unauthorized("Authentication required");
    }
}

export const authHelper = {
    getRoleRules: (profile: UserWithRoles): RoleRules => {
        assertProfile(profile);
        return getActiveRoleRules(profile);
    },

    resolvePermissions: (profile: UserWithRoles) => {
        assertProfile(profile);
        return resolveEffectivePermissions(getActiveRoleRules(profile));
    },

    hasPermission: (profile: UserWithRoles, permission: string) => {
        assertProfile(profile);
        return hasPermissionInRules(getActiveRoleRules(profile), permission);
    },

    hasPermissionAny: (profile: UserWithRoles, permissions: readonly string[]) => {
        assertProfile(profile);
        return hasAnyPermissionInRules(getActiveRoleRules(profile), [...permissions]);
    },

    checkPermission: (profile: UserWithRoles, permission: string) => {
        assertProfile(profile);

        if (!hasPermissionInRules(getActiveRoleRules(profile), permission)) {
            throw httpError.forbidden(`Permission required: ${permission}`);
        }

        return true;
    },

    checkPermissionAny: (profile: UserWithRoles, permissions: readonly string[]) => {
        assertProfile(profile);

        if (!hasAnyPermissionInRules(getActiveRoleRules(profile), [...permissions])) {
            throw httpError.forbidden(`One of these permissions required: ${permissions.join(", ")}`);
        }

        return true;
    },

    canManageAllGroups: (profile: UserWithRoles) => {
        assertProfile(profile);
        if (profileHasAnyRole(profile, [AuthRole.PROJECT_MANAGER])) {
            return false;
        }
        const rules = getActiveRoleRules(profile);
        return hasPermissionInRules(rules, Permission.GROUPS_CREATE)
            || hasPermissionInRules(rules, Permission.GROUPS_UPDATE)
            || hasPermissionInRules(rules, Permission.GROUPS_DELETE)
            || hasPermissionInRules(rules, Permission.GROUPS_START_WORKFLOW);
    },

    hasRoleAny: (profile: UserWithRoles, requiredRoles: readonly string[]) => {
        assertProfile(profile);
        return profileHasAnyRole(profile, requiredRoles);
    },

    checkRoleAny: (profile: UserWithRoles, requiredRoles: readonly string[]) => {
        assertProfile(profile);

        if (!profileHasAnyRole(profile, requiredRoles)) {
            throw httpError.forbidden(`One of these roles required: ${requiredRoles.join(", ")}`);
        }

        return true;
    },

    /**
     * Authorizes workflow actions using profile permissions and/or
     * dossier_assignments (MAKER, CHECKER_1, ...).
     */
    async checkWorkflowAccess(
        profile: UserWithRoles,
        input: {
            permission?: string;
            profileRoles?: readonly string[];
            workerRoles?: readonly string[];
            dossierId?: string;
            assignmentId?: string;
        },
    ) {
        assertProfile(profile);

        if (input.permission && hasPermissionInRules(getActiveRoleRules(profile), input.permission)) {
            return true;
        }

        if (input.profileRoles?.length && profileHasAnyRole(profile, input.profileRoles)) {
            return true;
        }

        if (input.dossierId && input.workerRoles?.length) {
            if (await hasActiveDossierAssignment(profile, input.workerRoles, input.dossierId)) {
                return true;
            }
        }

        if (input.assignmentId && input.workerRoles?.length) {
            if (await hasActiveAssignmentById(profile, input.workerRoles, input.assignmentId)) {
                return true;
            }
        }

        const required = input.permission
            ?? input.profileRoles?.join(", ")
            ?? "workflow access";
        throw httpError.forbidden(`Permission required: ${required}`);
    },

    checkAnyRole: (profile: UserWithRoles, role: string) => {
        return authHelper.checkRoleAny(profile, [role]);
    },

    checkAdmin: (profile: UserWithRoles) => {
        assertProfile(profile);

        if (profileHasAnyRole(profile, [AuthRole.PROJECT_MANAGER])
            && !profileHasAnyRole(profile, [AuthRole.ADMIN])) {
            throw httpError.forbidden("Admin access required");
        }

        if (profileHasAnyRole(profile, [AuthRole.ADMIN])) {
            return true;
        }

        for (const userRole of profile.userRoles) {
            const rules = parseRoleRules(userRole.role.rules);
            if (hasPermissionInRules(rules, "*")) {
                return true;
            }
        }

        throw httpError.forbidden("Admin access required");
    },

    checkAdminOrProjectManager: (profile: UserWithRoles) => {
        assertProfile(profile);

        if (profileHasAnyRole(profile, [AuthRole.ADMIN, AuthRole.PROJECT_MANAGER])) {
            return true;
        }

        for (const userRole of profile.userRoles) {
            const rules = parseRoleRules(userRole.role.rules);
            if (hasPermissionInRules(rules, "*")) {
                return true;
            }
        }

        throw httpError.forbidden("Admin or project manager access required");
    },
};
