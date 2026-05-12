import { httpError } from "@shared/common-lib";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";

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
};
