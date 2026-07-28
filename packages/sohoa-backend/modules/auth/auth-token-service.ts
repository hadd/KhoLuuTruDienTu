import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { authSessions, authSessionTokens, userProfiles, userRoles } from "../../db/schemas/index.ts";
import { httpError } from "@shared/common-lib";
import { getAccessTtlSeconds, getRefreshTtlSeconds, signAccessToken } from "../../libs/helpers/jwt.ts";
import { randomRefreshToken, sha256Hex, verifyPassword } from "../../libs/helpers/password.ts";
import { ProfileService } from "../profile/profile-service.ts";
import { resolveEffectivePermissionsFromUserRoles } from "./permission-resolver.ts";
import { logActivity } from "../audit-log/audit-log-activity.ts";

async function assertActiveSession(sessionId: string, userId: string) {
    const session = await db.query.authSessions.findFirst({
        where: and(
            eq(authSessions.id, sessionId),
            eq(authSessions.userId, userId),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
        ),
    });
    if (!session) {
        throw httpError.unauthorized("Session invalid or expired");
    }
}

export const AuthTokenService = {
    async issueTokensForUser(userId: string, meta: { userAgent: string | null; ip: string | null }) {
        const profile = await db.query.userProfiles.findFirst({
            where: and(eq(userProfiles.id, userId), isNull(userProfiles.deletedAt)),
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                    with: { role: true },
                },
            },
        });
        if (!profile) {
            throw httpError.unauthorized("User profile not found");
        }
        const now = new Date();
        const refreshTtlSec = getRefreshTtlSeconds();
        const accessTtlSec = getAccessTtlSeconds();
        const sessionExpires = new Date(now.getTime() + refreshTtlSec * 1000);
        const [session] = await db.insert(authSessions).values({
            userId,
            expiresAt: sessionExpires,
            userAgent: meta.userAgent,
            ip: meta.ip,
        }).returning();
        const refreshRaw = randomRefreshToken();
        const refreshHash = await sha256Hex(refreshRaw);
        await db.insert(authSessionTokens).values({
            sessionId: session.id,
            userId,
            type: "refresh_token",
            tokenHash: refreshHash,
            expiresAt: sessionExpires,
        });
        const jti = crypto.randomUUID();
        const accessExpiresAt = new Date(now.getTime() + accessTtlSec * 1000);
        const accessToken = await signAccessToken({
            sub: userId,
            sid: session.id,
            jti,
        });
        await db.insert(authSessionTokens).values({
            sessionId: session.id,
            userId,
            type: "access_token",
            tokenHash: jti,
            expiresAt: accessExpiresAt,
        });
        await db.update(userProfiles).set({
            lastLoginAt: now,
            updatedAt: now,
        }).where(eq(userProfiles.id, userId));
        const userRoleIds = profile?.userRoles?.map((ur) => ur.role?.id).filter((id): id is string => Boolean(id)) ?? [];
        const permissions = profile?.userRoles?.length
            ? resolveEffectivePermissionsFromUserRoles(profile.userRoles)
            : [];
        return {
            accessToken,
            refreshToken: refreshRaw,
            expiresIn: accessTtlSec,
            tokenType: "Bearer" as const,
            roles: userRoleIds,
            permissions,
        };
    },

    async loginWithPassword(email: string, password: string, meta: { userAgent: string | null; ip: string | null }) {
        const profile = await ProfileService.getByEmail(email);
        if (!profile?.passwordHash) {
            logActivity({
                module: "auth",
                eventType: "login_failed",
                summary: `Đăng nhập thất bại: ${email}`,
                ip: meta.ip,
                userAgent: meta.userAgent,
                requestMeta: {
                    method: "POST",
                    path: "/api/auth/login",
                    statusCode: 401,
                },
            });
            throw httpError.unauthorized("Invalid authentication credentials.");
        }
        const ok = await verifyPassword(password, profile.passwordHash);
        if (!ok) {
            logActivity({
                userId: profile.id,
                module: "auth",
                eventType: "login_failed",
                summary: `Đăng nhập thất bại: ${email}`,
                entityType: "user",
                entityId: profile.id,
                ip: meta.ip,
                userAgent: meta.userAgent,
                requestMeta: {
                    method: "POST",
                    path: "/api/auth/login",
                    statusCode: 401,
                },
            });
            throw httpError.unauthorized("Invalid authentication credentials.");
        }
        if (!profile.active) {
            throw httpError.forbidden("account is inactive");
        }
        const result = await this.issueTokensForUser(profile.id, meta);
        logActivity({
            userId: profile.id,
            module: "auth",
            eventType: "login",
            summary: `Đăng nhập thành công: ${email}`,
            entityType: "user",
            entityId: profile.id,
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestMeta: {
                method: "POST",
                path: "/api/auth/login",
                statusCode: 200,
            },
        });
        return result;
    },

    async refreshWithToken(refreshToken: string) {
        const refreshHash = await sha256Hex(refreshToken);
        const row = await db.query.authSessionTokens.findFirst({
            where: and(
                eq(authSessionTokens.tokenHash, refreshHash),
                eq(authSessionTokens.type, "refresh_token"),
                isNull(authSessionTokens.revokedAt),
                gt(authSessionTokens.expiresAt, new Date()),
            ),
        });
        if (!row) {
            throw httpError.unauthorized("Invalid or expired refresh token");
        }
        await assertActiveSession(row.sessionId, row.userId);
        const now = new Date();
        const accessTtlSec = getAccessTtlSeconds();
        const accessExpiresAt = new Date(now.getTime() + accessTtlSec * 1000);
        const jti = crypto.randomUUID();
        const accessToken = await signAccessToken({
            sub: row.userId,
            sid: row.sessionId,
            jti,
        });
        await db.insert(authSessionTokens).values({
            sessionId: row.sessionId,
            userId: row.userId,
            type: "access_token",
            tokenHash: jti,
            expiresAt: accessExpiresAt,
        });
        return { accessToken, expiresIn: accessTtlSec, tokenType: "Bearer" as const };
    },

    async revokeRefreshToken(refreshToken: string) {
        const refreshHash = await sha256Hex(refreshToken);
        const row = await db.query.authSessionTokens.findFirst({
            where: and(eq(authSessionTokens.tokenHash, refreshHash), eq(authSessionTokens.type, "refresh_token")),
        });
        if (!row) {
            return;
        }
        const now = new Date();
        await db.update(authSessionTokens).set({ revokedAt: now }).where(eq(authSessionTokens.sessionId, row.sessionId));
        await db.update(authSessions).set({ revokedAt: now }).where(eq(authSessions.id, row.sessionId));
    },

    async revokeSessionByIds(userId: string, sessionId: string) {
        const now = new Date();
        await db.update(authSessions).set({ revokedAt: now }).where(
            and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)),
        );
        await db.update(authSessionTokens).set({ revokedAt: now }).where(eq(authSessionTokens.sessionId, sessionId));
    },

    async revokeAllSessionsForUser(userId: string) {
        const now = new Date();
        await db.update(authSessions).set({ revokedAt: now }).where(
            and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)),
        );
        await db.update(authSessionTokens).set({ revokedAt: now }).where(
            and(eq(authSessionTokens.userId, userId), isNull(authSessionTokens.revokedAt)),
        );
    },

    async logout(userId: string, sessionId: string, meta?: { userAgent: string | null; ip: string | null }) {
        await this.revokeSessionByIds(userId, sessionId);
        logActivity({
            userId,
            module: "auth",
            eventType: "logout",
            summary: "Đăng xuất",
            entityType: "user",
            entityId: userId,
            ip: meta?.ip ?? null,
            userAgent: meta?.userAgent ?? null,
            requestMeta: {
                method: "POST",
                path: "/api/auth/logout",
                statusCode: 200,
            },
        });
    },
};
