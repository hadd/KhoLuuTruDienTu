import { getByPath, resolveTemplate } from "./audit-template.ts";
import { AUDIT_ROUTE_REGISTRY } from "./audit-route-registry.ts";
import type {
    AuditRouteDefinition,
    AuditRouteEnrichContext,
    AuditRouteEnrichResult,
} from "./audit-route-types.ts";

export type MatchedAuditRoute = {
    definition: AuditRouteDefinition;
    params: Record<string, string>;
};

export function normalizeAuditPathname(pathname: string): string {
    const segments = pathname.split("/").filter(Boolean);
    const apiIndex = segments.indexOf("api");
    if (apiIndex >= 0 && segments[apiIndex + 1] === "v1") {
        return `/${segments.slice(apiIndex + 2).join("/")}`;
    }
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function patternToRegex(pattern: string): RegExp {
    const parts = pattern.split("/").filter(Boolean);
    const regexParts = parts.map((part) => {
        if (part.startsWith(":")) return "([^/]+)";
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    return new RegExp(`^/${regexParts.join("/")}$`);
}

export function matchAuditRoute(
    method: string,
    pathname: string,
): MatchedAuditRoute | null {
    const normalizedPath = normalizeAuditPathname(pathname);
    const upperMethod = method.toUpperCase();

    for (const definition of AUDIT_ROUTE_REGISTRY) {
        if (definition.method.toUpperCase() !== upperMethod) continue;
        const regex = patternToRegex(definition.pattern);
        const match = normalizedPath.match(regex);
        if (!match) continue;

        const paramNames = definition.pattern
            .split("/")
            .filter(Boolean)
            .filter((part) => part.startsWith(":"))
            .map((part) => part.slice(1));

        const params: Record<string, string> = {};
        paramNames.forEach((name, index) => {
            params[name] = decodeURIComponent(match[index + 1] ?? "");
        });

        return { definition, params };
    }

    return null;
}

export type ResolvedRouteAudit = {
    module: string;
    eventType: string;
    summary: string | null;
    entityType: string | null;
    entityId: string | null;
    entityLabel: string | null;
    details: Record<string, unknown> | null;
};

function extractLabelFromSummary(summary: string | null | undefined): string | null {
    if (!summary) return null;
    const quoted = summary.match(/"([^"]+)"/);
    return quoted?.[1] ?? null;
}

function resolveEntityLabel(
    enrichResult: AuditRouteEnrichResult,
    entityId: string | null,
): string | null {
    return enrichResult.entityLabel
        ?? extractLabelFromSummary(enrichResult.summary)
        ?? entityId;
}

function buildTemplateContext(
    ctx: AuditRouteEnrichContext,
): Record<string, unknown> {
    return {
        params: ctx.params,
        body: ctx.body,
        response: ctx.response,
        profile: { id: ctx.profileId },
    };
}

function applyEnrichResult(
    definition: AuditRouteDefinition,
    enrichResult: AuditRouteEnrichResult,
): ResolvedRouteAudit {
    const entityId = enrichResult.entityId ?? null;
    return {
        module: enrichResult.module ?? definition.module,
        eventType: enrichResult.eventType ?? definition.eventType,
        summary: enrichResult.summary,
        entityType: enrichResult.entityType ?? definition.entityType ?? null,
        entityId,
        entityLabel: resolveEntityLabel(enrichResult, entityId),
        details: enrichResult.details ?? null,
    };
}

export async function resolveRouteAudit(
    ctx: AuditRouteEnrichContext,
): Promise<ResolvedRouteAudit | null> {
    const matched = matchAuditRoute(ctx.method, ctx.pathname);
    if (!matched) return null;

    const { definition, params } = matched;
    const enrichContext: AuditRouteEnrichContext = { ...ctx, params };

    if (definition.enrich) {
        try {
            const enrichResult = await definition.enrich(enrichContext);
            if (enrichResult) {
                return applyEnrichResult(definition, enrichResult);
            }
        } catch (err) {
            console.error("[AUDIT] Route enricher failed:", err);
        }
        return {
            module: definition.module,
            eventType: definition.eventType,
            summary: `${definition.eventType} ${definition.module}`,
            entityType: definition.entityType ?? null,
            entityId: enrichContext.params.id
                ?? enrichContext.params.dossierId
                ?? enrichContext.params.fileId
                ?? null,
            entityLabel: enrichContext.params.id
                ?? enrichContext.params.dossierId
                ?? enrichContext.params.fileId
                ?? null,
            details: null,
        };
    }

    const templateContext = buildTemplateContext(enrichContext);
    const summary = definition.summaryTemplate
        ? resolveTemplate(definition.summaryTemplate, templateContext)
        : `${definition.eventType} ${definition.module}`;
    const entityId = definition.entityIdFrom
        ? String(getByPath(templateContext, definition.entityIdFrom) ?? "")
        : null;

    return {
        module: definition.module,
        eventType: definition.eventType,
        summary,
        entityType: definition.entityType ?? null,
        entityId: entityId || null,
        entityLabel: entityId || null,
        details: null,
    };
}
