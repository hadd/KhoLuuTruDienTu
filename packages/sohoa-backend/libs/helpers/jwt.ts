import { SignJWT, jwtVerify } from "jose";
import { env } from "../../env.ts";

export type AccessTokenClaims = { sub: string; sid: string; jti: string; tkn: "access" };

export function getAccessSecretBytes(): Uint8Array {
    return new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
}

export function getAccessTtlSeconds(): number {
    return env.ACCESS_TOKEN_LIFE_TIME;
}

export function getRefreshTtlSeconds(): number {
    return env.REFRESH_TOKEN_LIFE_TIME;
}

type SignVerifyOpts = {
    secret?: Uint8Array;
    expiresInSeconds?: number;
};

export async function signAccessToken(
    payload: { sub: string; sid: string; jti: string },
    opts?: SignVerifyOpts,
): Promise<string> {
    const secret = opts?.secret ?? getAccessSecretBytes();
    const ttl = opts?.expiresInSeconds ?? getAccessTtlSeconds();
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return await new SignJWT({ tkn: "access", sid: payload.sid })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.sub)
        .setJti(payload.jti)
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(secret);
}

export async function verifyAccessToken(token: string, opts?: SignVerifyOpts): Promise<AccessTokenClaims> {
    const secret = opts?.secret ?? getAccessSecretBytes();
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const sid = typeof payload.sid === "string" ? payload.sid : "";
    const jti = typeof payload.jti === "string" ? payload.jti : "";
    const tkn = payload.tkn;
    if (!sub || !sid || !jti || tkn !== "access") {
        throw new Error("invalid access token payload");
    }
    return { sub, sid, jti, tkn: "access" };
}
