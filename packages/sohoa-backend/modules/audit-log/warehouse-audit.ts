import { logActivity } from "./audit-log-activity.ts";

export function formatDossierLabel(dossier: {
    name?: string | null;
    folderPath?: string | null;
    id: string;
}): string {
    const name = dossier.name?.trim();
    if (name) return name;
    const path = dossier.folderPath?.trim();
    if (path) return path;
    return dossier.id;
}

export function formatStatusChange(
    from: string | null | undefined,
    to: string | null | undefined,
): string {
    if (from && to) return `${from} → ${to}`;
    if (to) return to;
    if (from) return from;
    return "";
}

export function buildStatusDetails(
    fromStatus: string | null | undefined,
    toStatus: string | null | undefined,
): Record<string, unknown> {
    return {
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        statusChange: formatStatusChange(fromStatus, toStatus),
    };
}

type WarehouseAuditInput = {
    userId?: string | null;
    module: string;
    eventType: string;
    summary: string;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, unknown>;
    path?: string;
    action?: string;
};

export function logWarehouseAudit(input: WarehouseAuditInput): void {
    logActivity({
        userId: input.userId,
        module: input.module,
        eventType: input.eventType,
        summary: input.summary,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        requestMeta: {
            method: "EVENT",
            path: input.path ?? `/${input.module}/${input.eventType}`,
            statusCode: 200,
            action: input.action ?? `${input.eventType}-${input.module}`,
            requestBody: input.details,
        },
    });
}
