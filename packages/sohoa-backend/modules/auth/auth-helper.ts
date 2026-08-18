import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    WORKABLE_ASSIGNMENT_STATUSES,
} from "../../db/schemas/workflow-constants.ts";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { Permission, DOSSIER_SIGN_VIEW_PERMISSIONS, DOSSIER_WORKFLOW_DATA_PERMISSIONS } from "./permission-catalog.ts";
import {
    hasPermissionInRules,
    parseRoleRules,
    resolveEffectivePermissionsFromUserRoles,
    userRolesHaveAnyPermission,
    userRolesHavePermission,
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
    resolvePermissions: (profile: UserWithRoles) => {
        assertProfile(profile);
        return resolveEffectivePermissionsFromUserRoles(profile.userRoles);
    },

    hasPermission: (profile: UserWithRoles, permission: string) => {
        assertProfile(profile);
        return userRolesHavePermission(profile.userRoles, permission);
    },

    hasPermissionAny: (profile: UserWithRoles, permissions: readonly string[]) => {
        assertProfile(profile);
        return userRolesHaveAnyPermission(profile.userRoles, permissions);
    },

    checkPermission: (profile: UserWithRoles, permission: string) => {
        assertProfile(profile);

        if (!userRolesHavePermission(profile.userRoles, permission)) {
            throw httpError.forbidden(`Permission required: ${permission}`);
        }

        return true;
    },

    checkPermissionAny: (profile: UserWithRoles, permissions: readonly string[]) => {
        assertProfile(profile);

        if (!userRolesHaveAnyPermission(profile.userRoles, permissions)) {
            throw httpError.forbidden(`One of these permissions required: ${permissions.join(", ")}`);
        }

        return true;
    },

    /** Read dossier workflow data (assignments, history, issue reports) without requiring dossiers.read. */
    checkDossierWorkflowDataAccess: (profile: UserWithRoles) => {
        return authHelper.checkPermissionAny(profile, DOSSIER_WORKFLOW_DATA_PERMISSIONS);
    },

    /** View digital-sign status/history for a dossier. */
    checkDossierSignViewAccess: (profile: UserWithRoles) => {
        return authHelper.checkPermissionAny(profile, DOSSIER_SIGN_VIEW_PERMISSIONS);
    },

    canViewAllGroups: (profile: UserWithRoles) => {
        assertProfile(profile);
        return userRolesHavePermission(profile.userRoles, Permission.GROUPS_READ_ALL);
    },

    canManageAllGroups: (profile: UserWithRoles) => {
        assertProfile(profile);
        if (profileHasAnyRole(profile, [AuthRole.PROJECT_MANAGER])) {
            return false;
        }
        return userRolesHaveAnyPermission(profile.userRoles, [
            Permission.GROUPS_CREATE,
            Permission.GROUPS_UPDATE,
            Permission.GROUPS_DELETE,
            Permission.GROUPS_START_WORKFLOW,
        ]);
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

        if (input.permission && userRolesHavePermission(profile.userRoles, input.permission)) {
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

    isAdmin: (profile: UserWithRoles) => {
        if (!profile) return false;

        if (profileHasAnyRole(profile, [AuthRole.PROJECT_MANAGER])
            && !profileHasAnyRole(profile, [AuthRole.ADMIN])) {
            return false;
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

        return false;
    },

    getHiddenModules: (profile: UserWithRoles) => {
        if (!profile) return [];
        if (authHelper.isAdmin(profile)) {
            return [];
        }

        const managingRoles = profile.userRoles.filter(ur => {
            const rules = parseRoleRules(ur.role.rules);
            return hasPermissionInRules(rules, Permission.ROLES_MANAGE);
        });

        if (managingRoles.length === 0) {
            return [];
        }

        let hiddenModules: string[] | null = null;
        for (const ur of managingRoles) {
            let roleHidden: string[] = [];
            try {
                const raw = (ur.role as any).hiddenModules;
                if (raw) {
                    roleHidden = JSON.parse(raw);
                }
            } catch {
                // ignore parsing error
            }

            if (hiddenModules === null) {
                hiddenModules = [...roleHidden];
            } else {
                // Intersect hidden modules: a module is hidden only if ALL managing roles hide it.
                hiddenModules = hiddenModules.filter(m => roleHidden.includes(m));
            }
        }

        return hiddenModules || [];
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
