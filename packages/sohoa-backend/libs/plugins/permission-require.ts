import { Elysia } from "elysia";
import { httpError } from "@shared/common-lib";
import { authHelper } from "../../modules/auth/auth-helper.ts";
import { plAuthProfile } from "./auth-profile.ts";

export const plPermissionAny = (requiredRoles: string[]) => {
    return new Elysia({
        name: "plugin__permissionRequireAnyRoles",
    })
        .use(plAuthProfile)
        .derive(({ profile }) => {
            if (!profile) {
                throw httpError.unauthorized("Authentication required");
            }

            authHelper.checkRoleAny(profile, requiredRoles);
            return { profile };
        })
        .as("scoped");
};

export const plPermission = (permission: string) => {
    return new Elysia({
        name: `plugin__permissionRequire_${permission}`,
    })
        .use(plAuthProfile)
        .derive(({ profile }) => {
            if (!profile) {
                throw httpError.unauthorized("Authentication required");
            }

            authHelper.checkPermission(profile, permission);
            return { profile };
        })
        .as("scoped");
};

export const plPermissionsAny = (permissions: string[]) => {
    return new Elysia({
        name: "plugin__permissionRequireAny",
    })
        .use(plAuthProfile)
        .derive(({ profile }) => {
            if (!profile) {
                throw httpError.unauthorized("Authentication required");
            }

            authHelper.checkPermissionAny(profile, permissions);
            return { profile };
        })
        .as("scoped");
};
