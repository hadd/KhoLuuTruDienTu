import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { AssignmentStatus } from "../../db/schemas/workflow-constants.ts";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";

export const AuthRole = {
    ADMIN: "admin",
    QC: "qc",
    EDITOR: "editor",
} as const;

/** Roles in user_roles that can perform data-entry (maker) tasks */
export const DATA_ENTRY_MAKER_PROFILE_ROLES = [
    AuthRole.ADMIN,
    AuthRole.EDITOR,
] as const;

/** Roles in user_roles that can perform QC (checker) tasks */
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
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
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
            eq(dossierAssignments.status, AssignmentStatus.IN_PROGRESS),
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
     * Authorizes workflow actions using user_roles (admin/qc/editor) and/or
     * dossier_assignments (MAKER, CHECKER_1, ...).
     */
    async checkWorkflowAccess(
        profile: UserWithRoles,
        input: {
            profileRoles: readonly string[];
            workerRoles?: readonly string[];
            dossierId?: string;
            assignmentId?: string;
        },
    ) {
        assertProfile(profile);

        if (profileHasAnyRole(profile, input.profileRoles)) {
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

        throw httpError.forbidden(`One of these roles required: ${input.profileRoles.join(", ")}`);
    },

    checkAnyRole: (profile: UserWithRoles, role: string) => {
        return authHelper.checkRoleAny(profile, [role]);
    },

    checkAdmin: (profile: UserWithRoles) => {
        return authHelper.checkAnyRole(profile, AuthRole.ADMIN);
    },
};
