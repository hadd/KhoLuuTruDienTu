import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { userProfiles, userRoles } from "../../db/schemas/index.ts";
import { eq, isNull } from "drizzle-orm";
import { resolveEffectivePermissionsFromUserRoles, parseRulesForResponse } from "./permission-resolver.ts";

export async function buildMeResponse(userId: string) {
    const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, userId),
        with: {
            userRoles: {
                where: isNull(userRoles.expiredAt),
                with: {
                    role: true,
                },
            },
        },
    });

    if (!profile) {
        throw httpError.unauthorized("User profile not found");
    }

    if (profile.deletedAt) {
        throw httpError.forbidden("account is deleted");
    }

    const userRolesWithParsedRules = profile.userRoles.map((userRole) => ({
        ...userRole,
        role: userRole.role
            ? {
                ...userRole.role,
                rules: parseRulesForResponse(userRole.role.rules),
            }
            : userRole.role,
    }));

    const permissions = resolveEffectivePermissionsFromUserRoles(userRolesWithParsedRules);

    return {
        ...profile,
        passwordHash: undefined,
        userRoles: userRolesWithParsedRules,
        permissions,
    };
}
