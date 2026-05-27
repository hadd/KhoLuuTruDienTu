import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { QC_CHECKER_WORKFLOW, WorkerRole } from "../../db/schemas/workflow-constants.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import {
    authHelper,
    DATA_ENTRY_MAKER_PROFILE_ROLES,
    DATA_ENTRY_QC_PROFILE_ROLES,
} from "../auth/auth-helper.ts";
import { DataEntryService as service } from "./data-entry-service.ts";
import {
    approveCheckerBodySchema,
    claimResponseSchema,
    rejectCheckerBodySchema,
    rejectResponseSchema,
    submitResponseSchema,
} from "./types.ts";

const tags = ["Data Entry"];
const CHECKER_WORKER_ROLES = QC_CHECKER_WORKFLOW.map((config) => config.role);

export function createDataEntryRouter(basePath: string = "/data-entry") {
    const app = new Elysia({
        name: "dataEntryRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/maker/claim",
        async ({ profile }) => {
            authHelper.checkRoleAny(profile, DATA_ENTRY_MAKER_PROFILE_ROLES);
            return await service.getMakerAssignment(profile.id);
        },
        {
            response: claimResponseSchema,
            detail: {
                tags,
                summary: "Get assigned dossier for data entry",
                description:
                    "Returns one assigned dossier per request. Prioritizes ENTRY_PROCESSING (in progress), then any CHECKER_N_REJECTED, then READY_FOR_ENTRY. Returns dossier files with presigned URLs.",
            },
        },
    );

    app.post(
        "/checker/approve/:dossierId",
        async ({ profile, params, body }) => {
            await authHelper.checkWorkflowAccess(profile, {
                profileRoles: DATA_ENTRY_QC_PROFILE_ROLES,
                workerRoles: CHECKER_WORKER_ROLES,
                dossierId: params.dossierId,
            });
            return await service.approveCheckerByDossier(
                params.dossierId,
                profile.id,
                body.metadata,
            );
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            body: approveCheckerBodySchema,
            response: submitResponseSchema,
            detail: {
                tags,
                summary: "Checker approves entry metadata (auto-detect step from currentQcStep)",
                description:
                    "Uploads checker-edited metadata to MinIO under Curated/metadata_update, resolves the checker step from dossier.currentQcStep (step = currentQcStep + 1), then approves the in-progress assignment for that role.",
            },
        },
    );

    for (const { step, role } of QC_CHECKER_WORKFLOW) {
        app.post(
            `/checker${step}/claim`,
            async ({ profile }) => {
                authHelper.checkRoleAny(profile, DATA_ENTRY_QC_PROFILE_ROLES);
                return await service.claimChecker(profile.id, role);
            },
            {
                response: claimResponseSchema,
                detail: {
                    tags,
                    summary: `CHECKER_${step} claims a dossier for review`,
                },
            },
        );

        app.post(
            `/checker${step}/reject/:assignmentId`,
            async ({ profile, params, body }) => {
                await authHelper.checkWorkflowAccess(profile, {
                    profileRoles: DATA_ENTRY_QC_PROFILE_ROLES,
                    workerRoles: [role],
                    assignmentId: params.assignmentId,
                });
                return await service.rejectChecker(
                    params.assignmentId,
                    profile.id,
                    role,
                    body.notes,
                );
            },
            {
                params: t.Object({ assignmentId: IdParam("Assignment ID") }),
                body: rejectCheckerBodySchema,
                response: rejectResponseSchema,
                detail: {
                    tags,
                    summary: `CHECKER_${step} rejects entry metadata`,
                },
            },
        );
    }

    return app;
}
