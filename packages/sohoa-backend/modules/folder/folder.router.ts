import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { FolderService as service } from "./folder-service.ts";
import { DossierService as dossierService } from "../dossier/dossier-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { submitMetadataBodySchema } from "../data-entry/types.ts";
import { listDossierFilesQuerySchema } from "./types.ts";
import { isPermanentDeleteFlag } from "../dossier/dossier-delete-utils.ts";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";

const permanentDeleteQuerySchema = t.Object({
    permanent: t.Optional(t.Union([
        t.Boolean(),
        t.Literal("true"),
        t.Literal("false"),
    ], {
        description: "When true, permanently deletes dossiers and folders from DB and MinIO.",
    })),
});

const metadataExportColumnSchema = t.Object({
    header: t.String({ minLength: 1, maxLength: 255 }),
    fieldKeys: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
    separator: t.String({ maxLength: 32 }),
});

const metadataExportBodySchema = t.Object({
    presetId: t.Optional(t.String({ format: "uuid" })),
    columns: t.Optional(t.Array(metadataExportColumnSchema, { minItems: 1 })),
});

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
        async ({ urlQuery, profile }) => {
            return await service.listAllParents(urlQuery.projectCode);
        },
        {
            detail: {
                tags,
                summary: "List root folders",
                description:
                    "Returns root folders (parentId is null). Optional projectCode filters by project.",
            },
        },
    );

    app.get(
        "/dossiers/:dossierId/files",
        async ({ params, query, profile }) => {
            return await service.listDossierFiles(params.dossierId, {
                actorId: profile.id,
                status: query.status,
            });
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            query: listDossierFilesQuerySchema,
            detail: {
                tags,
                summary: "List dossier files",
                description:
                    "Returns all files belonging to the given dossier, including fileUrl (raw presigned URL), searchablePdfPath, and searchablePdfUrl (mirrored under searchable_pdf/). " +
                    "By default currentMetadataUrl points to currentMetadataKey. Pass ?status=draft to load the assignment-scoped draft metadata file instead.",
            },
        },
    );

    app.put(
        "/dossiers/:dossierId/metadata",
        async ({ params, body, profile }) => {
            await authHelper.checkWorkflowAccess(profile, {
                permission: Permission.DATA_ENTRY_MAKER,
                workerRoles: [WorkerRole.MAKER],
                dossierId: params.dossierId,
            });
            return await dossierService.saveDossierMetadata(
                params.dossierId,
                body.metadata,
                profile.id,
                body.issue_report,
            );
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            body: submitMetadataBodySchema,
            detail: {
                tags,
                summary: "Save dossier metadata",
                description:
                    "Uploads the edited JSON metadata to MinIO, marks the MAKER assignment COMPLETED, moves the dossier to WAITING_CHECKER_1 (or APPROVED / WAITING_ISSUE_RESOLUTION when requiredQcCount is 0), and logs SUBMIT_ENTRY. Returns the new presigned currentMetadataUrl.",
            },
        },
    );

    app.get(
        "/dossiers/:dossierId/metadata",
        async ({ params, profile }) => {
            return await dossierService.getDossierMetadataDraft(params.dossierId, profile.id);
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            query: listDossierFilesQuerySchema,
            detail: {
                tags,
                summary: "Get dossier metadata draft",
                description:
                    "Compatibility endpoint for loading the logged-in editor/checker's assignment-scoped draft metadata JSON.",
            },
        },
    );

    app.get(
        "/:id/metadata/export/fields",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
            return await dossierService.getFolderMetadataExportFields(params.id);
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            detail: {
                tags,
                summary: "List exportable metadata fields for a folder",
            },
        },
    );

    app.post(
        "/:id/metadata/export/preview",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
            return await dossierService.previewApprovedMetadataExportByFolder(params.id, body);
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            body: metadataExportBodySchema,
            detail: {
                tags,
                summary: "Preview folder metadata export",
            },
        },
    );

    app.post(
        "/:id/metadata/export",
        async ({ params, body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
            const { buffer, filename, contentType } = await dossierService.exportApprovedMetadataByFolder(
                params.id,
                body,
            );
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;
            set.headers["Content-Type"] = contentType;
            return buffer;
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            body: metadataExportBodySchema,
            detail: {
                tags,
                summary: "Export folder metadata with column configuration",
            },
        },
    );

    app.get(
        "/:id/metadata/export",
        async ({ params, profile, set }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
            const { buffer, filename, contentType } = await dossierService.exportApprovedMetadataByFolder(params.id);
            set.headers["Content-Disposition"] = `attachment; filename="${filename}"`;
            set.headers["Content-Type"] = contentType;
            return buffer;
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            detail: {
                tags,
                summary: "Export bộ hồ sơ metadata (ZIP)",
                description:
                    "Trả về ZIP: một file Excel tổng hợp metadata động ở gốc (mỗi hồ sơ một dòng) và PDF theo từng hồ sơ trong thư mục con `{ho_so}/pdfs/`. " +
                    "Yêu cầu: mọi hồ sơ trong bộ (gồm thư mục con) phải APPROVED và có currentMetadataKey.",
            },
        },
    );

    app.get(
        "/:id/all-first-subfolders",
        async ({ params, urlQuery, profile }) => {
            return await service.listAllFirstSubfolders(params.id, urlQuery.projectCode);
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            detail: {
                tags,
                summary: "List first-level children of a folder",
                description:
                    "Returns subfolders when present; otherwise returns dossiers in the folder. Optional projectCode filters by project. Every subfolder includes isAssigned, computed recursively: true only when every dossier in that subfolder and all nested subfolders is assigned (assignedGroupId or a non-TRANSFERRED dossier assignment). Subfolders may also include dossierId and status from a direct dossier on the same folderId. Each child and the response include totalSizeKb (KB) summed recursively from all nested subfolders and dossier files.",
            },
        },
    );

    app.get(
        "/",
        async ({ urlQuery, profile }) => {
            return await service.list(urlQuery);
        },
        docs.list,
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
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
        async ({ body, profile, set }) => {
            const record = await service.create(body);
            set.status = 201;
            return { record, status: "created" };
        },
        docs.create,
    );

    app.put(
        "/:id",
        async ({ params, body, profile }) => {
            const record = await service.update(params.id, body);
            return { record, status: "updated" };
        },
        docs.update,
    );

    app.post(
        "/:id/revoke-assignments",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_ASSIGN);
            const result = await dossierService.revokeByFolderId(params.id, profile.id);
            return { ...result, status: "revoked" };
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            detail: {
                tags,
                summary: "Thu hồi phân công theo thư mục",
                description:
                    "Thu hồi phân công cho các hồ sơ trong thư mục đã chọn (gồm thư mục con). " +
                    "Chỉ áp dụng hồ sơ READY_FOR_ENTRY chưa bắt đầu nhập liệu; hủy assignment đang active và xóa assignedGroupId nếu có. " +
                    "Hồ sơ đang ENTRY_PROCESSING, QC hoặc đã duyệt sẽ được bỏ qua.",
            },
        },
    );

    app.delete(
        "/:id/dossiers",
        async ({ params, query, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            const record = await dossierService.deleteByFolderId(params.id, {
                permanent: isPermanentDeleteFlag(query.permanent),
            });
            return { record, status: "deleted" };
        },
        {
            params: t.Object({ id: IdParam("Folder ID") }),
            query: permanentDeleteQuerySchema,
            detail: {
                tags,
                summary: "Delete all dossiers in a folder (soft or permanent)",
                description:
                    "Deletes every dossier under the folder and its subfolders, then soft-deletes or hard-deletes those folder records. " +
                    "Default is soft delete (deletedAt). Use permanent=true to purge MinIO (raw + doc_json mirrors) and remove rows from the database.",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            const record = await service.delete(params.id);
            return { record, status: "deleted" };
        },
        docs.delete,
    );

    return app;
}
