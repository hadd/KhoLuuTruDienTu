import { httpError } from "@shared/common-lib";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";

export const AuthRole = {
    ADMIN: "admin",
} as const;

export const authHelper = {
    checkRoleAny: (profile: UserWithRoles, requiredRoles: string[]) => {
        if (!profile) {
            throw httpError.unauthorized("Authentication required");
        }

        const hasRequiredRole = profile.userRoles.some(
            (userRole) => requiredRoles.includes(userRole.role.id),
        );

        if (!hasRequiredRole) {
            throw httpError.forbidden(`One of these roles required: ${requiredRoles.join(", ")}`);
        }

        return true;
    },

    checkAnyRole: (profile: UserWithRoles, role: string) => {
        const normalizedRole = role.toLowerCase();
        return authHelper.checkRoleAny(profile, [normalizedRole]);
    },

    checkAdmin: (profile: UserWithRoles) => {
        return authHelper.checkAnyRole(profile, AuthRole.ADMIN);
    },
};
