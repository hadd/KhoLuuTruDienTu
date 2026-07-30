import { db } from "../../db/db-conn.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { queueWorkflowAudit, type WorkflowAuditInput } from "../audit-log/workflow-audit-bridge.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WorkflowLogWriteInput = {
    dossierId: string;
    actorId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    notes?: string | null;
};

export async function insertWorkflowLog(
    tx: DbTx,
    input: WorkflowLogWriteInput,
): Promise<{ id: string }> {
    const [row] = await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        notes: input.notes ?? null,
    }).returning({ id: workflowLogs.id });

    return row;
}

export function queueWorkflowAuditFromLog(
    input: WorkflowLogWriteInput,
    workflowLogId?: string | null,
): void {
    const auditInput: WorkflowAuditInput = {
        ...input,
        workflowLogId: workflowLogId ?? null,
    };
    queueWorkflowAudit(auditInput);
}
