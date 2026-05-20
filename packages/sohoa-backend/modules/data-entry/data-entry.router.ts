import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { DataEntryService as service } from "./data-entry-service.ts";
import {
    claimResponseSchema,
    rejectChecker1BodySchema,
    rejectResponseSchema,
    submitMetadataBodySchema,
    submitResponseSchema,
} from "./types.ts";

const tags = ["Data Entry"];

export function createDataEntryRouter(basePath: string = "/data-entry") {
    const app = new Elysia({
        name: "dataEntryRouter",
        prefix: basePath,
    });

    app.post(
        "/maker/claim",
        async ({ profile }) => {
            authHelper.checkRoleAny(profile, [WorkerRole.MAKER]);
            return await service.claimMaker(profile.id);
        },
        {
            response: claimResponseSchema,
            detail: {
                tags,
                summary: "MAKER claims a dossier for data entry",
                description:
                    "Prioritizes CHECKER_1_REJECTED over READY_FOR_ENTRY. Returns dossier files with presigned URLs.",
            },
        },
    );

    app.post(
        "/maker/submit/:assignmentId",
        async ({ profile, params, body }) => {
            authHelper.checkRoleAny(profile, [WorkerRole.MAKER]);
            return await service.submitMaker(params.assignmentId, profile.id, body.metadata);
        },
        {
            params: t.Object({ assignmentId: IdParam("Assignment ID") }),
            body: submitMetadataBodySchema,
            response: submitResponseSchema,
            detail: {
                tags,
                summary: "MAKER submits entry metadata",
            },
        },
    );

    app.post(
        "/checker1/claim",
        async ({ profile }) => {
            authHelper.checkRoleAny(profile, [WorkerRole.CHECKER_1]);
            return await service.claimChecker1(profile.id);
        },
        {
            response: claimResponseSchema,
            detail: {
                tags,
                summary: "CHECKER_1 claims a dossier for review",
            },
        },
    );

    app.post(
        "/checker1/approve/:assignmentId",
        async ({ profile, params, body }) => {
            authHelper.checkRoleAny(profile, [WorkerRole.CHECKER_1]);
            return await service.approveChecker1(params.assignmentId, profile.id, body.metadata);
        },
        {
            params: t.Object({ assignmentId: IdParam("Assignment ID") }),
            body: submitMetadataBodySchema,
            response: submitResponseSchema,
            detail: {
                tags,
                summary: "CHECKER_1 approves entry metadata",
            },
        },
    );

    app.post(
        "/checker1/reject/:assignmentId",
        async ({ profile, params, body }) => {
            authHelper.checkRoleAny(profile, [WorkerRole.CHECKER_1]);
            return await service.rejectChecker1(params.assignmentId, profile.id, body.notes);
        },
        {
            params: t.Object({ assignmentId: IdParam("Assignment ID") }),
            body: rejectChecker1BodySchema,
            response: rejectResponseSchema,
            detail: {
                tags,
                summary: "CHECKER_1 rejects entry metadata",
            },
        },
    );

    return app;
}
