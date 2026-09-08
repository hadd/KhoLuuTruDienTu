import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { authSessions, authSessionTokens, userProfiles, userRoles, authTwoFactorOtps } from "../../db/schemas/index.ts";
import { httpError } from "@shared/common-lib";
import { getAccessTtlSeconds, getRefreshTtlSeconds, signAccessToken } from "../../libs/helpers/jwt.ts";
import { randomRefreshToken, sha256Hex, verifyPassword } from "../../libs/helpers/password.ts";
import { ProfileService } from "../profile/profile-service.ts";
import { resolveEffectivePermissionsFromUserRoles, userRolesHavePermission } from "./permission-resolver.ts";
import { Permission } from "./permission-catalog.ts";
import { authHelper } from "./auth-helper.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { sendNotificationEmail } from "../../libs/notification-email.ts";
import { logActivity } from "../audit-log/audit-log-activity.ts";

function maskEmail(email: string): string {
    const [name, domain] = email.split("@");
    if (!domain) return email;
    const maskedName = name.length <= 2
        ? name[0] + "*"
        : name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
    return `${maskedName}@${domain}`;
}

function generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

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

        const fullProfile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, profile.id),
            with: {
                userRoles: {
                    where: isNull(userRoles.expiredAt),
                    with: { role: true },
                },
            },
        });

        const isAdmin = fullProfile ? authHelper.isAdmin(fullProfile as UserWithRoles) : false;
        const requires2FA = !isAdmin && fullProfile?.userRoles?.length
            ? userRolesHavePermission(fullProfile.userRoles, Permission.AUTH_TWO_FACTOR_REQUIRE)
            : false;

        if (requires2FA) {
            const otpCode = generateOtpCode();
            const otpHash = await sha256Hex(otpCode);
            const challengeToken = crypto.randomUUID();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

            await db.insert(authTwoFactorOtps).values({
                userId: profile.id,
                challengeToken,
                otpHash,
                attempts: 0,
                expiresAt,
                lastSentAt: now,
            });

            try {
                await sendNotificationEmail({
                    to: profile.email,
                    subject: "Mã OTP xác thực đăng nhập 2 lớp",
                    text: `Mã OTP xác thực đăng nhập của bạn là: ${otpCode}. Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.`,
                });
            } catch (err) {
                console.error("Failed to send 2FA OTP email:", err);
                throw httpError.internalServerError("Không thể gửi email OTP xác thực 2 lớp. Vui lòng kiểm tra lại cấu hình SMTP.");
            }

            return {
                require2FA: true,
                challengeToken,
                maskedEmail: maskEmail(profile.email),
                expiresIn: 300,
            };
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
        return {
            require2FA: false,
            ...result,
        };
    },

    async verify2FA(challengeToken: string, otpCode: string, meta: { userAgent: string | null; ip: string | null }) {
        const now = new Date();
        const record = await db.query.authTwoFactorOtps.findFirst({
            where: and(
                eq(authTwoFactorOtps.challengeToken, challengeToken),
                isNull(authTwoFactorOtps.usedAt),
                gt(authTwoFactorOtps.expiresAt, now),
            ),
        });

        if (!record) {
            throw httpError.badRequest("Mã thách thức không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
        }

        if (record.attempts >= 5) {
            throw httpError.badRequest("Mã OTP đã nhập sai quá 5 lần. Vui lòng đăng nhập lại.");
        }

        const inputOtpHash = await sha256Hex(otpCode.trim());
        if (inputOtpHash !== record.otpHash) {
            await db.update(authTwoFactorOtps)
                .set({ attempts: record.attempts + 1 })
                .where(eq(authTwoFactorOtps.id, record.id));
            throw httpError.badRequest(`Mã OTP không chính xác. Bạn còn ${4 - record.attempts} lần thử.`);
        }

        await db.update(authTwoFactorOtps)
            .set({ usedAt: now })
            .where(eq(authTwoFactorOtps.id, record.id));

        const result = await this.issueTokensForUser(record.userId, meta);
        const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, record.userId),
        });

        logActivity({
            userId: record.userId,
            module: "auth",
            eventType: "login",
            summary: `Đăng nhập thành công (2FA): ${profile?.email ?? record.userId}`,
            entityType: "user",
            entityId: record.userId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestMeta: {
                method: "POST",
                path: "/api/auth/verify-2fa",
                statusCode: 200,
            },
        });

        return {
            require2FA: false,
            ...result,
        };
    },

    async resend2FA(challengeToken: string) {
        const now = new Date();
        const record = await db.query.authTwoFactorOtps.findFirst({
            where: and(
                eq(authTwoFactorOtps.challengeToken, challengeToken),
                isNull(authTwoFactorOtps.usedAt),
            ),
        });

        if (!record) {
            throw httpError.badRequest("Mã thách thức không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
        }

        const secondsSinceLastSent = (now.getTime() - new Date(record.lastSentAt).getTime()) / 1000;
        if (secondsSinceLastSent < 60) {
            const waitSeconds = Math.ceil(60 - secondsSinceLastSent);
            throw httpError.badRequest(`Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu gửi lại mã OTP.`);
        }

        const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, record.userId),
        });

        if (!profile?.email) {
            throw httpError.badRequest("Không tìm thấy email của người dùng.");
        }

        const newOtpCode = generateOtpCode();
        const newOtpHash = await sha256Hex(newOtpCode);
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        await db.update(authTwoFactorOtps)
            .set({
                otpHash: newOtpHash,
                attempts: 0,
                expiresAt,
                lastSentAt: now,
            })
            .where(eq(authTwoFactorOtps.id, record.id));

        try {
            await sendNotificationEmail({
                to: profile.email,
                subject: "Mã OTP xác thực đăng nhập 2 lớp (Gửi lại)",
                text: `Mã OTP xác thực đăng nhập mới của bạn là: ${newOtpCode}. Mã này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.`,
            });
        } catch (err) {
            console.error("Failed to resend 2FA OTP email:", err);
            throw httpError.internalServerError("Không thể gửi email OTP xác thực 2 lớp. Vui lòng kiểm tra lại cấu hình SMTP.");
        }

        return {
            status: "otp_resent",
            expiresIn: 300,
        };
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
