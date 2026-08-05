export function normalizeClientIp(ip: string | null | undefined): string | null {
    if (!ip) return null;
    const trimmed = ip.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("::ffff:")) {
        return trimmed.slice("::ffff:".length) || null;
    }
    return trimmed;
}

export function resolveClientIp(request: Request): string | null {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        const normalized = normalizeClientIp(first);
        if (normalized) return normalized;
    }

    const realIp = normalizeClientIp(request.headers.get("x-real-ip"));
    if (realIp) return realIp;

    const cfIp = normalizeClientIp(request.headers.get("cf-connecting-ip"));
    if (cfIp) return cfIp;

    return null;
}

export function requestWithClientIp(
    request: Request,
    remoteIp: string | null | undefined,
): Request {
    const existing = resolveClientIp(request);
    if (existing) return request;

    const normalized = normalizeClientIp(remoteIp);
    if (!normalized) return request;

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-for", normalized);
    return new Request(request, { headers });
}
