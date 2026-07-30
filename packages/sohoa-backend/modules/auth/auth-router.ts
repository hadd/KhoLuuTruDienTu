import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { ProfileService } from "../profile/profile-service.ts";
import { httpError } from "@shared/common-lib";
import { AuthTokenService } from "./auth-token-service.ts";
import { buildMeResponse } from "./auth-config.ts";

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
                const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                    ?? request.headers.get("x-real-ip");
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
                    summary: "Login with email and password",
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
                const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                    ?? request.headers.get("x-real-ip");

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
