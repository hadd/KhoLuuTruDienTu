import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { DossierService as service } from "./dossier-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import {
    assignDossierBodySchema,
    checkFilePathQuerySchema,
    createDocumentFromStorageBodySchema,
    createDossierSchema,
    createUploadPointBodySchema,
} from "./types.ts";

export function createDossierRouter(basePath: string = "/dossiers") {
    const meta = service.getMetadata?.();
    const tags = [["Dossier", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "dossierRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/",
        async ({ urlQuery }) => await service.list(urlQuery),
        docs.list,
    );

    app.get(
        "/check-file-path",
        async ({ query }) => await service.checkFilePathExists(query.filePath),
        {
            query: checkFilePathQuerySchema,
            detail: {
                tags,
                summary: "Check if file path exists in database",
                description: "Returns exists: false when no dossier file record matches the path.",
            },
        },
    );

    app.post(
        "/create-upload-point",
        async ({ body }) => await service.createUploadPoint(body),
        {
            body: createUploadPointBodySchema,
            detail: {
                tags,
                summary: "Create S3 presigned POST upload policy",
            },
        },
    );

    app.post(
        "/create-document-from-storage",
        async ({ body, set }) => {
            const result = await service.createDocumentFromStorage(body);
            set.status = result.created ? 201 : 200;
            return { ...result, status: result.created ? "created" : "existing" };
        },
        {
            body: createDocumentFromStorageBodySchema,
            detail: {
                tags,
                summary: "Register document from S3 storage",
                description:
                    "Verifies object exists on S3, ensures folder/dossier records, and creates dossier file if not present.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params }) => {
            const record = await service.get(params.id, {
                with: { folder: true, files: true },
            });
            return { record };
        },
        {
            ...docs.get,
            params: t.Object({ id: IdParam("Dossier ID") }),
        },
    );

    app.post(
        "/",
        async ({ body, set }) => {
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body }) => {
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        docs.update,
    );

    app.delete(
        "/:id",
        async ({ params }) => {
            const record = await service.delete(params.id);
            return { record, status: "deleted" };
        },
        docs.delete,
    );

    app.post(
        "/:id/assign",
        async ({ params, body, profile }) => {
            const result = await service.assignDossier(
                {
                    dossierId: params.id,
                    assigneeId: body.assigneeId,
                    role: body.role,
                },
                profile.id,
            );
            return { ...result, status: "assigned" };
        },
        {
            params: t.Object({ id: IdParam("Dossier ID") }),
            body: assignDossierBodySchema,
            detail: {
                tags,
                summary: "Assign dossier to a user",
                description:
                    "Assigns a dossier to a specific user by role. Validates dossier status and prevents duplicate active assignments.",
            },
        },
    );

    return app;
}
