export function getByPath(source: unknown, path: string): unknown {
    if (!path.trim()) return source;
    return path.split(".").reduce<unknown>((acc, key) => {
        if (acc === null || acc === undefined || typeof acc !== "object") {
            return undefined;
        }
        if (Array.isArray(acc)) {
            const index = Number(key);
            return Number.isInteger(index) ? acc[index] : undefined;
        }
        return (acc as Record<string, unknown>)[key];
    }, source);
}

export function resolveTemplate(
    template: string,
    context: Record<string, unknown>,
): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, rawPath: string) => {
        const value = getByPath(context, rawPath.trim());
        if (value === null || value === undefined) return "";
        return String(value);
    }).replace(/\s+/g, " ").trim();
}
