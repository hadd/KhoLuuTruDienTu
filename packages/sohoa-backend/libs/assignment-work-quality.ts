import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
    WorkQuality,
    type WorkerRole as WorkerRoleType,
} from "../db/schemas/workflow-constants.ts";
import {
    parseAllowedFields,
    canonicalizeMetadataFieldKeys,
    rejectFieldMatchesAssignmentScope,
    shouldResetMakerOnReject,
} from "./metadata-field-filter.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Một biên tập duy nhất → mọi thay đổi của QC sau đều tính sai. */
export function fieldChangeAffectsMaker(
    changedFieldKeys: string[],
    allowedFields: string[] | null,
    singleMaker: boolean,
): boolean {
    const canonicalKeys = canonicalizeMetadataFieldKeys(changedFieldKeys);
    if (canonicalKeys.length === 0) {
        return false;
    }
    if (singleMaker) {
        return true;
    }
    return canonicalKeys.some((field) =>
        rejectFieldMatchesAssignmentScope(field, allowedFields)
    );
}

function priorCheckerRoles(beforeStep: number): WorkerRoleType[] {
    return QC_CHECKER_WORKFLOW
        .filter((config) => config.step < beforeStep)
        .map((config) => config.role);
}

async function markAssignmentsIncorrect(
    tx: DbTx,
    assignmentIds: string[],
) {
    if (assignmentIds.length === 0) {
        return;
    }

    await tx
        .update(dossierAssignments)
        .set({ workQuality: WorkQuality.INCORRECT })
        .where(inArray(dossierAssignments.id, assignmentIds));
}

/** Đánh dấu sai khi QC reject — biên tập bị mở lại và các checker trước đó. */
export async function markAssignmentsIncorrectOnReject(
    tx: DbTx,
    input: {
        dossierId: string;
        rejectingCheckerStep: number;
        rejectFields: string[] | null;
    },
) {
    const selectiveReject = input.rejectFields != null && input.rejectFields.length > 0;

    const completedMakers = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
        ),
        columns: { id: true, allowedFields: true },
    });

    const makerIdsToMark = completedMakers
        .filter((maker) =>
            shouldResetMakerOnReject(
                parseAllowedFields(maker.allowedFields),
                selectiveReject ? input.rejectFields : null,
            )
        )
        .map((maker) => maker.id);

    const priorRoles = priorCheckerRoles(input.rejectingCheckerStep);
    const priorCheckerIds = priorRoles.length === 0
        ? []
        : (await tx.query.dossierAssignments.findMany({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                inArray(
                    dossierAssignments.role,
                    priorRoles as [WorkerRoleType, ...WorkerRoleType[]],
                ),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
            ),
            columns: { id: true },
        })).map((row) => row.id);

    await markAssignmentsIncorrect(tx, [...makerIdsToMark, ...priorCheckerIds]);
}

/** Đánh dấu biên tập (và checker trước) sai khi QC sửa metadata rồi duyệt. */
export async function markAssignmentsIncorrectOnCheckerEdit(
    tx: DbTx,
    input: {
        dossierId: string;
        checkerStep: number;
        changedFieldKeys: string[];
        skipMakerOnConfirmedIssueReport?: boolean;
    },
) {
    const changedFieldKeys = canonicalizeMetadataFieldKeys(input.changedFieldKeys);
    if (changedFieldKeys.length === 0) {
        return;
    }

    const skipMaker = input.skipMakerOnConfirmedIssueReport === true;

    const completedMakers = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
        ),
        columns: { id: true, allowedFields: true },
    });

    const singleMaker = completedMakers.length === 1;
    const makerIdsToMark = skipMaker
        ? []
        : completedMakers
            .filter((maker) =>
                fieldChangeAffectsMaker(
                    changedFieldKeys,
                    parseAllowedFields(maker.allowedFields),
                    singleMaker,
                )
            )
            .map((maker) => maker.id);

    const priorRoles = priorCheckerRoles(input.checkerStep);
    const priorCheckerIds = priorRoles.length === 0
        ? []
        : (await tx.query.dossierAssignments.findMany({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                inArray(
                    dossierAssignments.role,
                    priorRoles as [WorkerRoleType, ...WorkerRoleType[]],
                ),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
            ),
            columns: { id: true },
        })).map((row) => row.id);

    await markAssignmentsIncorrect(tx, [...makerIdsToMark, ...priorCheckerIds]);
}
