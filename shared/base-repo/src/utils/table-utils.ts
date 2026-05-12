export function toCamelCase(s: string): string {
    if (s.length === 0) return s;
    const trimmed = s.replace(/^[_-]+/, "");
    if (trimmed.length === 0) return s;
    const firstChar = trimmed[0].toLowerCase();
    const rest = trimmed.slice(1).replace(/[_-](\w)/g, (_: string, c: string) => c.toUpperCase());
    return firstChar + rest;
}

export function getTableName(table: unknown): string | undefined {
    const tbl = table as Record<string | symbol, unknown>;
    const drizzleName = tbl?.[Symbol.for("drizzle:Name")];
    return (
        (drizzleName as string | undefined) ??
        (tbl?.tableName as string) ??
        (tbl?.dbName as string) ??
        ((tbl?._ as Record<string, unknown>)?.name as string) ??
        (tbl?.name as string) ??
        undefined
    );
}

export function inferRelationalQueryKey(table: unknown, availableQueryKeys: string[]): string | undefined {
    if (!availableQueryKeys.length) return undefined;
    const rawName = getTableName(table);
    if (!rawName || typeof rawName !== "string") return undefined;
    const candidates = [
        rawName,
        toCamelCase(rawName),
        rawName.replace(/s$/, ""),
        toCamelCase(rawName.replace(/s$/, "")),
    ];
    for (const candidate of candidates) {
        if (availableQueryKeys.includes(candidate)) return candidate;
    }
    const lowerMap = new Map(availableQueryKeys.map((k) => [k.toLowerCase(), k]));
    for (const candidate of candidates) {
        const m = lowerMap.get(candidate.toLowerCase());
        if (m) return m;
    }
    return undefined;
}

export function sanitizeWithObject(withObj: Record<string, unknown> | null | undefined): Record<string, unknown> {
    if (!withObj || typeof withObj !== "object") return {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(withObj)) {
        if (value === true) out[key] = true;
        else if (value && typeof value === "object" && !Array.isArray(value)) {
            const nested = sanitizeWithObject(value as Record<string, unknown>);
            if (Object.keys(nested).length > 0) out[key] = nested;
        } else if (value !== false) out[key] = value;
    }
    return out;
}
