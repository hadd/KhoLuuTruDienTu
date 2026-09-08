import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { ProfileService } from "../profile/profile-service.ts";
import { httpError } from "@shared/common-lib";
import { AuthTokenService } from "./auth-token-service.ts";
import { buildMeResponse } from "./auth-config.ts";
import { resolveClientIp } from "../../libs/resolve-client-ip.ts";

export function createAuthPublicRouter(basePath: string = "/api/auth") {
    return new Elysia({
        name: "auth-public",
        prefix: basePath,
    })
        .post(
            "/login",
            async ({ body, request }) => {
                const { email, password } = body;
                if (!email?.trim() || !password) {
                    throw httpError.badRequest("email and password are required");
                }
                const ua = request.headers.get("user-agent");
                const ip = resolveClientIp(request);
                return await AuthTokenService.loginWithPassword(email.trim(), password, {
                    userAgent: ua,
                    ip,
                });
            },
            {
                body: t.Object({
                    email: t.String(),
                    password: t.String(),
                }),
                response: {
                    200: t.Object({
                        require2FA: t.Optional(t.Boolean()),
                        challengeToken: t.Optional(t.String()),
                        maskedEmail: t.Optional(t.String()),
                        accessToken: t.Optional(t.String()),
                        refreshToken: t.Optional(t.String()),
                        expiresIn: t.Number(),
                        tokenType: t.Optional(t.Literal("Bearer")),
                        roles: t.Optional(t.Array(t.String())),
                        permissions: t.Optional(t.Array(t.String())),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Login with email and password",
                },
            },
        )
        .post(
            "/verify-2fa",
            async ({ body, request }) => {
                const { challengeToken, otpCode } = body;
                if (!challengeToken || !otpCode) {
                    throw httpError.badRequest("challengeToken and otpCode are required");
                }
                const ua = request.headers.get("user-agent");
                const ip = resolveClientIp(request);
                return await AuthTokenService.verify2FA(challengeToken, otpCode, {
                    userAgent: ua,
                    ip,
                });
            },
            {
                body: t.Object({
                    challengeToken: t.String(),
                    otpCode: t.String(),
                }),
                response: {
                    200: t.Object({
                        require2FA: t.Literal(false),
                        accessToken: t.String(),
                        refreshToken: t.String(),
                        expiresIn: t.Number(),
                        tokenType: t.Literal("Bearer"),
                        roles: t.Array(t.String()),
                        permissions: t.Array(t.String()),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Verify 2FA OTP code and complete login",
                },
            },
        )
        .post(
            "/resend-2fa",
            async ({ body }) => {
                const { challengeToken } = body;
                if (!challengeToken) {
                    throw httpError.badRequest("challengeToken is required");
                }
                return await AuthTokenService.resend2FA(challengeToken);
            },
            {
                body: t.Object({
                    challengeToken: t.String(),
                }),
                response: {
                    200: t.Object({
                        status: t.String(),
                        expiresIn: t.Number(),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Resend 2FA OTP code to user email",
                },
            },
        )
        .post(
            "/refresh",
            async ({ body }) => {
                const { refreshToken } = body;
                if (!refreshToken) {
                    throw httpError.badRequest("refreshToken is required");
                }
                return await AuthTokenService.refreshWithToken(refreshToken);
            },
            {
                body: t.Object({
                    refreshToken: t.String(),
                }),
                response: {
                    200: t.Object({
                        accessToken: t.String(),
                        expiresIn: t.Number(),
                        tokenType: t.Literal("Bearer"),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Obtain a new access token using a refresh token",
                },
            },
        )
        .post(
            "/logout",
            async ({ body }) => {
                const { refreshToken } = body;
                if (!refreshToken) {
                    throw httpError.badRequest("refreshToken is required");
                }
                await AuthTokenService.revokeRefreshToken(refreshToken);
                return { status: "logged_out" };
            },
            {
                body: t.Object({
                    refreshToken: t.String(),
                }),
                response: {
                    200: t.Object({
                        status: t.String(),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Revoke session for the given refresh token",
                },
            },
        );
}

export function createAuthProtectedRouter(basePath: string = "/api/auth") {
    return new Elysia({
        name: "auth-protected",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog)
        .get(
            "/me",
            async ({ profile }) => {
                if (!profile) {
                    throw httpError.unauthorized("User profile not found");
                }
                return await buildMeResponse(profile.id);
            },
            {
                detail: {
                    tags: ["Authentication"],
                    summary: "Current user profile and roles",
                    security: [{ BearerAuth: [] }],
                },
            },
        )
        .post(
            "/logout",
            async ({ profile, auth, request }) => {
                if (!profile) {
                    throw httpError.unauthorized("User profile not found");
                }
                const ua = request.headers.get("user-agent");
                const ip = resolveClientIp(request);

                (request as any).__auditMeta = { skip: true };

                await AuthTokenService.logout(profile.id, auth.claims.sid, {
                    userAgent: ua,
                    ip: ip ?? null,
                });
                return { status: "logged_out" };
            },
            {
                response: {
                    200: t.Object({
                        status: t.String(),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Logout current session",
                    security: [{ BearerAuth: [] }],
                },
            },
        )
        .delete(
            "/me",
            async ({ profile, auth }) => {
                if (!profile) {
                    throw httpError.unauthorized("User profile not found");
                }
                await AuthTokenService.revokeSessionByIds(profile.id, auth.claims.sid);
                const result = await ProfileService.deleteUser(profile.id);
                return { record: result, status: "deleted" };
            },
            {
                response: {
                    200: t.Object({
                        record: t.Object({
                            id: t.String(),
                        }),
                        status: t.String(),
                    }),
                },
                detail: {
                    tags: ["Authentication"],
                    summary: "Delete current user account",
                    security: [{ BearerAuth: [] }],
                },
            },
        );
}
