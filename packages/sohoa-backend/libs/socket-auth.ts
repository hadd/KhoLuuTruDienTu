import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { authSessions } from "../db/schemas/auth_session.ts";
import { userProfiles } from "../db/schemas/user_profile.ts";
import { verifyAccessToken } from "./helpers/jwt.ts";

export type SocketAuthUser = {
    userId: string;
    sessionId: string;
};

export async function verifySocketAccessToken(token: string): Promise<SocketAuthUser> {
    const trimmed = token.trim();
    if (!trimmed) {
        throw new Error("missing token");
    }

    const claims = await verifyAccessToken(trimmed);

    const session = await db.query.authSessions.findFirst({
        where: and(
            eq(authSessions.id, claims.sid),
            eq(authSessions.userId, claims.sub),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
        ),
    });
    if (!session) {
        throw new Error("session invalid or expired");
    }

    const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, claims.sub),
        columns: { id: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt) {
        throw new Error("user not found");
    }

    return { userId: claims.sub, sessionId: claims.sid };
}

export function extractSocketToken(
    auth: unknown,
    authorizationHeader: string | undefined,
): string | null {
    if (auth && typeof auth === "object" && "token" in auth) {
        const token = (auth as { token?: unknown }).token;
        if (typeof token === "string" && token.trim()) {
            return token.trim();
        }
    }

    if (authorizationHeader?.startsWith("Bearer ")) {
        const token = authorizationHeader.slice("Bearer ".length).trim();
        return token || null;
    }

    return null;
}
