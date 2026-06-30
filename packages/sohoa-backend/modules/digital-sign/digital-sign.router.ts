import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { DigitalSignService as service } from "./digital-sign-service.ts";
import {
    prepareBatchBodySchema,
    prepareDossierBodySchema,
    submitBatchSignatureBodySchema,
    submitSignatureBodySchema,
} from "./digital-sign-schema.ts";

const tags = ["Digital Sign"];

export function createDigitalSignRouter(basePath: string = "/digital-sign") {
    const app = new Elysia({
        name: "digitalSignRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.post(
        "/prepare",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_SIGN);
            return await service.prepareDossier(body);
        },
        {
            body: prepareDossierBodySchema,
            detail: {
                tags,
                summary: "Prepare digital signing for all unsigned PDF files in a dossier",
            },
        },
    );

    app.post(
        "/batch/prepare",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_SIGN);
            return await service.prepareBatch(body);
        },
        {
            body: prepareBatchBodySchema,
            detail: {
                tags,
                summary: "Prepare digital signing for multiple dossiers",
            },
        },
    );

    app.post(
        "/submit",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_SIGN);
            return await service.submitSignature(body, profile.id);
        },
        {
            body: submitSignatureBodySchema,
            detail: {
                tags,
                summary: "Submit CMS signature for one PDF file",
            },
        },
    );

    app.post(
        "/batch/submit",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_SIGN);
            return await service.submitSignature(body, profile.id);
        },
        {
            body: submitBatchSignatureBodySchema,
            detail: {
                tags,
                summary: "Submit CMS signature for one file in a batch signing session",
            },
        },
    );

    app.get(
        "/status/:dossierId",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.getDossierSignStatus(params.dossierId);
        },
        {
            detail: {
                tags,
                summary: "Get per-file digital signing status for a dossier",
            },
        },
    );

    app.get(
        "/history/:dossierId",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.listDossierSignatureHistory(params.dossierId);
        },
        {
            detail: {
                tags,
                summary: "List digital signature audit trail for a dossier",
            },
        },
    );

    app.post(
        "/verify/:fileId",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.verifyFileSignature(params.fileId);
        },
        {
            detail: {
                tags,
                summary: "Verify embedded digital signature on a signed PDF file",
            },
        },
    );

    return app;
}
