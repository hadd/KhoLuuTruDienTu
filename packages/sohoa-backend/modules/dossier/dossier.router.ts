import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { DossierService as service } from "./dossier-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    assignByFolderIdBodySchema,
    assignDossierBodySchema,
    listAssignmentsByRoleQuerySchema,
    checkFilePathQuerySchema,
    createDocumentFromStorageBodySchema,
    createUploadPointBodySchema,
} from "./types.ts";
import { submitMetadataBodySchema } from "../data-entry/types.ts";
import { isPermanentDeleteFlag } from "./dossier-delete-utils.ts";

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
        async ({ urlQuery, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/check-file-path",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.checkFilePathExists(query.filePath);
        },
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
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            return await service.createUploadPoint(body);
        },
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
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
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
        "/assignments/by-role",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.listAssignmentsByRole(profile.id, query);
        },
        {
            query: listAssignmentsByRoleQuerySchema,
            detail: {
                tags,
                summary: "List my dossier assignments by role",
                description:
                    "Returns dossier assignments of the logged-in user for a worker role (MAKER, CHECKER_1, …). Each dossier includes files with filePath and fullPath (presigned URL from file_path). Optional filter: status.",
            },
        },
    );

    app.post(
        "/assign-by-folder",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_ASSIGN);
            const result = await service.assignByFolderId(
                {
                    folderId: body.folderId,
                    assigneeId: body.assigneeId ?? profile.id,
                    role: body.role,
                },
                profile.id,
            );
            return { ...result, status: "assigned" };
        },
        {
            body: assignByFolderIdBodySchema,
            detail: {
                tags,
                summary: "Assign dossiers by folder",
                description:
                    "Finds the deepest folders under the selected folder that contain dossier files, then creates dossier_assignments records for each matching dossier. Skips dossiers that already have an active assignment for the same role.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
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
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        docs.update,
    );

    app.delete(
        "/:id",
        async ({ params, query, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            const record = await service.delete(params.id, {
                permanent: isPermanentDeleteFlag(query.permanent),
            });
            return { record, status: "deleted" };
        },
        {
            ...docs.delete,
            query: t.Object({
                permanent: t.Optional(t.Union([
                    t.Boolean(),
                    t.Literal("true"),
                    t.Literal("false"),
                ], {
                    description: "When true, permanently deletes the dossier from the database and MinIO. Default is soft delete (deletedAt only).",
                })),
            }),
            detail: {
                ...docs.delete.detail,
                summary: "Delete a dossier (soft or permanent)",
                description:
                    "Default: soft delete — sets deletedAt, keeps DB relations and MinIO objects. " +
                    "Default soft delete sets deletedAt on the dossier and on orphan folder records (leaf + empty parents). permanent=true also purges MinIO and hard-deletes dossier and folder rows.",
            },
        },
    );

    app.get(
        "/:id/metadata/export",
        async ({ params, profile, set }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
            const { buffer, filename, contentType } = await service.exportMetadataExcel(params.id);
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;
            set.headers["Content-Type"] = contentType;
            return buffer;
        },
        {
            params: t.Object({ id: IdParam("Dossier ID") }),
            detail: {
                tags,
                summary: "Export dossier metadata to Excel",
                description:
                    "Downloads the current metadata JSON from MinIO (currentMetadataKey), generates a formatted Excel file, bundles all related PDF documents, and returns a ZIP archive.",
            },
        },
    );

    app.put(
        "/:id/metadata",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            return await service.saveDossierMetadata(params.id, body.metadata, profile.id);
        },
        {
            params: t.Object({ id: IdParam("Dossier ID") }),
            body: submitMetadataBodySchema,
            detail: {
                tags,
                summary: "Save dossier metadata",
                description:
                    "Uploads the edited JSON metadata to MinIO, marks the MAKER assignment COMPLETED, moves the dossier to WAITING_CHECKER_1, and logs SUBMIT_ENTRY. Returns the new presigned currentMetadataUrl.",
            },
        },
    );

    app.post(
        "/:id/assign",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_ASSIGN);
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
