export type AuditRouteEnrichContext = {
    method: string;
    pathname: string;
    params: Record<string, string>;
    body: unknown;
    response: unknown;
    profileId?: string | null;
};

export type AuditRouteEnrichResult = {
    summary: string;
    entityType?: string | null;
    entityId?: string | null;
    entityLabel?: string | null;
    details?: Record<string, unknown>;
    module?: string;
    eventType?: string;
};

export type AuditRouteEnricher = (
    ctx: AuditRouteEnrichContext,
) => AuditRouteEnrichResult | null | Promise<AuditRouteEnrichResult | null>;

export type AuditRouteDefinition = {
    method: string;
    pattern: string;
    module: string;
    eventType: string;
    entityType?: string;
    entityIdFrom?: string;
    summaryTemplate?: string;
    enrich?: AuditRouteEnricher;
};
