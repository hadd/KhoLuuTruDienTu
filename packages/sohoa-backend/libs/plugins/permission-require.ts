import { Elysia } from "elysia";
import { httpError } from "@shared/common-lib";
import {plAuthProfile} from "./auth-profile.ts";

export const plPermissionAny = (requiredRoles: string[] ) => {
    return new Elysia({
        name: "plugin__permissionRequireAny",
    })
        .use(plAuthProfile)
        .derive(({ profile }) => {
            // // todo: tạm thời cho phép all
            // return { profile };

            // Check if profile exists - if not, user is not authenticated
            if (!profile) {
                throw httpError.unauthorized("Authentication required");
            }

            const hasRequiredRole = profile.userRoles.some(
                (userRole) => requiredRoles.some((required) => {
                    const normalizedRequired = required.trim().toUpperCase().replace(/[\s-]+/g, "_");
                    const roleId = userRole.role.id.trim().toUpperCase().replace(/[\s-]+/g, "_");
                    const roleName = userRole.role.name.trim().toUpperCase().replace(/[\s-]+/g, "_");
                    return roleId === normalizedRequired || roleName === normalizedRequired;
                }),
            );

            if (!hasRequiredRole) {
                throw httpError.forbidden(`One of these roles required: ${requiredRoles.join(", ")}`);
            }

            return { profile };
        })
        .as("scoped");
};
