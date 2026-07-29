import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { QC_CHECKER_WORKFLOW } from "../../db/schemas/workflow-constants.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { DataEntryService as service } from "./data-entry-service.ts";
import {
    approveCheckerBodySchema,
    claimResponseSchema,
    rejectCheckerBodySchema,
    rejectResponseSchema,
    submitResponseSchema,
} from "./types.ts";

const tags = ["Data Entry"];
const CHECKER_WORKER_ROLES = QC_CHECKER_WORKFLOW.map((c) => c.role);

export function createDataEntryRouter(basePath: string = "/data-entry") {
    const app = new Elysia({
        name: "dataEntryRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/maker/claim",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DATA_ENTRY_MAKER);
            return await service.getMakerAssignment(profile.id);
        },
        {
            response: claimResponseSchema,
            detail: {
                tags,
                summary: "Get assigned dossier for data entry",
                description:
                    "Returns one assigned dossier per request. Skips assignments in DRAFT (resume those from the assignments list). Prioritizes ENTRY_PROCESSING (in progress), then any CHECKER_N_REJECTED, then READY_FOR_ENTRY. Returns dossier files with presigned URLs. When the MAKER assignment has allowedFields (field-level ACL), currentMetadata contains only permitted groups/fields (including value: null) and currentMetadataUrl is null — the client must render currentMetadata and must not fetch the presigned URL. When allowedFields is null, use currentMetadataUrl for full metadata as before.",
            },
        },
    );

    app.get(
        "/maker/dossiers/:dossierId",
        async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.DATA_ENTRY_MAKER);
            return await service.getMakerAssignmentForDossier(
                profile.id,
                params.dossierId,
            );
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            response: claimResponseSchema,
            detail: {
                tags,
                summary: "Get maker claim payload for a specific dossier",
                description:
                    "Returns claim payload (metadata, allowedFields, files) for the logged-in editor when they have an IN_PROGRESS/DRAFT MAKER assignment on the dossier. Reopens a completed legacy PHONG-slot assignment when the dossier is still in maker entry.",
            },
        },
    );

    app.post(
        "/checker/approve/:dossierId",
        async ({ profile, params, body }) => {
            await authHelper.checkWorkflowAccess(profile, {
                permission: Permission.DATA_ENTRY_CHECKER,
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

    app.post(
        "/checker/reject/:dossierId",
        async ({ profile, params, body }) => {
            await authHelper.checkWorkflowAccess(profile, {
                permission: Permission.DATA_ENTRY_CHECKER,
                workerRoles: CHECKER_WORKER_ROLES,
                dossierId: params.dossierId,
            });
            return await service.rejectCheckerByDossier(
                params.dossierId,
                profile.id,
                body.notes,
                body.reject_fields,
            );
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            body: rejectCheckerBodySchema,
            response: rejectResponseSchema,
            detail: {
                tags,
                summary: "Checker rejects entry metadata (auto-detect step from currentQcStep)",
                description:
                    "Resolves the checker step from dossier.currentQcStep (step = currentQcStep + 1), then rejects the in-progress assignment for that role. Optional reject_fields (GROUP.FIELD or GROUP.*) reopens only editors whose assignment scope overlaps those fields.",
            },
        },
    );

    return app;
}
