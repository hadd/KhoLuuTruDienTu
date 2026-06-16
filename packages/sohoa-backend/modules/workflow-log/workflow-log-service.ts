import { desc, eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";

export async function listWorkflowLogs(dossierId: string) {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: { id: true },
    });
    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    const rows = await db
        .select({
            id: workflowLogs.id,
            action: workflowLogs.action,
            fromStatus: workflowLogs.fromStatus,
            toStatus: workflowLogs.toStatus,
            notes: workflowLogs.notes,
            createdAt: workflowLogs.createdAt,
            actorId: workflowLogs.actorId,
            actorName: userProfiles.fullName,
            actorEmail: userProfiles.email,
        })
        .from(workflowLogs)
        .leftJoin(userProfiles, eq(workflowLogs.actorId, userProfiles.id))
        .where(eq(workflowLogs.dossierId, dossierId))
        .orderBy(desc(workflowLogs.createdAt));

    return rows;
}
