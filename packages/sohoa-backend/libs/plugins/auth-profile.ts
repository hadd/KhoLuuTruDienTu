import { Elysia } from "elysia";
import { db } from "../../db/db-conn.ts";
import { type UserProfile, userProfiles } from "../../db/schemas/user_profile.ts";
import { type UserRole, userRoles } from "../../db/schemas/user_role.ts";
import { type Role } from "../../db/schemas/role.ts";
import { authSessions } from "../../db/schemas/auth_session.ts";
import { httpError } from "@shared/common-lib";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cache } from "@shared/cache-lib";
import { verifyAccessToken, type AccessTokenClaims } from "../helpers/jwt.ts";

export type UserWithRoles = UserProfile & {
    userRoles: (UserRole & {
        role: Role;
    })[];
};

export type AuthContext = {
    accessToken: string | null;
    claims: AccessTokenClaims;
};

async function verifyBearerToken(authHeader: string | null): Promise<{ token: string; claims: AccessTokenClaims }> {
    if (!authHeader?.startsWith("Bearer ")) {
        throw httpError.unauthorized("Authentication required");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
        throw httpError.unauthorized("Authentication required");
    }
    try {
        const claims = await verifyAccessToken(token);
        return { token, claims };
    } catch {
        throw httpError.unauthorized("Invalid or expired token");
    }
}

async function assertSessionActive(claims: AccessTokenClaims) {
    const session = await db.query.authSessions.findFirst({
        where: and(
            eq(authSessions.id, claims.sid),
            eq(authSessions.userId, claims.sub),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
        ),
    });
    if (!session) {
        throw httpError.unauthorized("Session invalid or expired");
    }
}

async function getUserProfileWithRoles(userId: string): Promise<UserWithRoles> {
    const cacheKey = `profile:${userId}`;
    return await cache.user.getOrSet<UserWithRoles>({
        key: cacheKey,
        factory: async () => {
            const profileData = await db.query.userProfiles.findFirst({
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

            if (profileData?.deletedAt) {
                throw httpError.forbidden("account is deleted");
            }

            if (!profileData) {
                throw httpError.unauthorized("User profile not found");
            }

            return profileData as UserWithRoles;
        },
    });
}

export const plAuthProfile = new Elysia({
    name: "plugin_authWithProfile",
})
    .derive<{ auth: AuthContext; profile: UserWithRoles }>(async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const { token, claims } = await verifyBearerToken(authHeader);
        await assertSessionActive(claims);
        const profile = await getUserProfileWithRoles(claims.sub);
        return {
            auth: { accessToken: token, claims },
            profile,
        };
    }).as("scoped");
