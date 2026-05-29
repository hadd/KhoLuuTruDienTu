import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { FolderService as service } from "./folder-service.ts";
import { DossierService as dossierService } from "../dossier/dossier-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { submitMetadataBodySchema } from "../data-entry/types.ts";
export function createFolderRouter(basePath: string = "/folders") {
    const meta = service.getMetadata?.();
    const tags = [["Folder", ...(meta?.tags || [])].join(" ")];
    const docs = service.getDocs({ tags });

    const app = new Elysia({
        name: "folderRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/all-parent",
        async () => await service.listAllParents(),
        {
            detail: {
                tags,
                summary: "List root folders",
                description: "Returns all folders without a parent (parentId is null).",
            },
        },
    );

    app.get(
        "/dossiers/:dossierId/files",
        async ({ params }) => await service.listDossierFiles(params.dossierId),
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            detail: {
                tags,
                summary: "List dossier files",
                description: "Returns all files belonging to the given dossier.",
            },
        },
    );

    app.put(
        "/dossiers/:dossierId/metadata",
        async ({ params, body, profile }) =>
            await dossierService.saveDossierMetadata(
                params.dossierId,
                body.metadata,
                profile.id,
            ),
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            body: submitMetadataBodySchema,
            detail: {
                tags,
                summary: "Save dossier metadata",
                description:
                    "Uploads the edited JSON metadata to MinIO, marks the MAKER assignment COMPLETED, moves the dossier to WAITING_CHECKER_1, and logs SUBMIT_ENTRY. Returns the new presigned currentMetadataUrl.",
            },
        },
    );

    app.get(
        "/:id/all-first-subfolders",
        async ({ params }) => await service.listAllFirstSubfolders(params.id),
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            detail: {
                tags,
                summary: "List first-level children of a folder",
                description:
                    "Returns subfolders when present; otherwise returns dossiers in the folder. Subfolders include dossier status when a dossier references the same folderId.",
            },
        },
    );

    app.get(
        "/",
        async ({ urlQuery }) => await service.list(urlQuery),
        docs.list,
    );

    app.get(
        "/:id",
        async ({ params }) => {
            const record = await service.get(params.id, {
                with: { parent: true, children: true, dossiers: true },
            });
            return { record };
        },
        {
            ...docs.get,
            params: t.Object({ id: IdParam("Folder ID") }),
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

    return app;
}
