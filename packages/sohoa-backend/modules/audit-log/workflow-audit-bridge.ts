import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { logActivity } from "./audit-log-activity.ts";
import { buildStatusDetails, formatDossierLabel } from "./warehouse-audit.ts";

type WorkflowAuditMapping = {
    module: string;
    eventType: string;
    summaryPrefix: string;
};

const WORKFLOW_AUDIT_MAP: Record<string, WorkflowAuditMapping> = {
    SUBMIT_ARCHIVE: {
        module: "archive",
        eventType: "submit_archive",
        summaryPrefix: "Nộp lưu kho hồ sơ",
    },
    APPROVE_ARCHIVE: {
        module: "archive",
        eventType: "approve_archive",
        summaryPrefix: "Duyệt lưu kho hồ sơ",
    },
    REJECT_ARCHIVE: {
        module: "archive",
        eventType: "reject_archive",
        summaryPrefix: "Từ chối lưu kho hồ sơ",
    },
};

export type WorkflowAuditInput = {
    dossierId: string;
    actorId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    notes?: string | null;
    workflowLogId?: string | null;
};

export async function logAuditFromWorkflowLog(input: WorkflowAuditInput): Promise<void> {
    const mapping = WORKFLOW_AUDIT_MAP[input.action];
    if (!mapping) return;

    const [dossier] = await db
        .select({
            id: dossiers.id,
            name: dossiers.name,
            folderPath: dossiers.folderPath,
        })
        .from(dossiers)
        .where(activeDossierWhere(eq(dossiers.id, input.dossierId)))
        .limit(1);

    const dossierLabel = dossier ? formatDossierLabel(dossier) : input.dossierId;
    const statusDetails = buildStatusDetails(input.fromStatus, input.toStatus);

    logActivity({
        userId: input.actorId,
        module: mapping.module,
        eventType: mapping.eventType,
        summary: `${mapping.summaryPrefix} "${dossierLabel}"`,
        entityType: "dossier",
        entityId: input.dossierId,
        sourceLogId: input.workflowLogId ?? null,
        requestMeta: {
            method: "EVENT",
            path: `/workflow/${input.action.toLowerCase()}`,
            statusCode: 200,
            action: `${mapping.eventType}-${mapping.module}`,
            requestBody: {
                action: input.action,
                dossierId: input.dossierId,
                dossierName: dossierLabel,
                rejectNotes: input.notes ?? null,
                ...statusDetails,
            },
        },
    });
}

export function queueWorkflowAudit(input: WorkflowAuditInput): void {
    void logAuditFromWorkflowLog(input).catch((err) => {
        console.error("[AUDIT] Failed to project workflow log:", err);
    });
}
