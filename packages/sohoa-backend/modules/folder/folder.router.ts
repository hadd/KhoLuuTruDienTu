import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { FolderService as service } from "./folder-service.ts";
import { DossierService as dossierService } from "../dossier/dossier-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { submitMetadataBodySchema } from "../data-entry/types.ts";
import {
  assignFolderProjectBodySchema,
  listDossierFilesQuerySchema,
} from "./types.ts";
import { isPermanentDeleteFlag } from "../dossier/dossier-delete-utils.ts";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";
import { resolveFolderBrowseScope } from "./folder-browse-scope.ts";
import { zipStreamResponse } from "../../libs/zip-stream-response.ts";
import {
  clientMetaFromRequest,
  withDownloadLog,
} from "../download/download-log-service.ts";
import {
  assertDownloadAllowedForExport,
  securityAccessHeadersFromRequest,
} from "../security-level/security-enforcement.ts";

const permanentDeleteQuerySchema = t.Object({
  permanent: t.Optional(
    t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")], {
      description:
        "When true, permanently deletes dossiers and folders from DB and MinIO.",
    }),
  ),
});

const metadataExportColumnSchema = t.Object({
  header: t.String({ minLength: 1, maxLength: 255 }),
  fieldKeys: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
  separator: t.String({ maxLength: 32 }),
});

const metadataExportBodySchema = t.Object({
  presetId: t.Optional(t.String({ format: "uuid" })),
  columns: t.Optional(t.Array(metadataExportColumnSchema, { minItems: 1 })),
  placementId: t.Optional(t.String({ format: "uuid" })),
  applyWatermark: t.Optional(t.Boolean()),
  dossierAccessPassword: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
});

const multiFolderMetadataExportBodySchema = t.Object({
  folderIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
  presetId: t.Optional(t.String({ format: "uuid" })),
  columns: t.Optional(t.Array(metadataExportColumnSchema, { minItems: 1 })),
  placementId: t.Optional(t.String({ format: "uuid" })),
  applyWatermark: t.Optional(t.Boolean()),
  dossierAccessPassword: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
});

async function assertSecurityDownloadForFolders(
  profile: { id: string },
  request: Request,
  folderIds: string[],
): Promise<{ applyWatermark: boolean; skippedFileIds: Set<string> }> {
  const dossierIds =
    await dossierService.listApprovedExportDossierIds(folderIds);
  const headers = securityAccessHeadersFromRequest(request);
  return await assertDownloadAllowedForExport({
    userId: profile.id,
    dossierIds,
    levelToken: headers.levelToken,
    dossierToken: headers.dossierToken,
  });
}

export function createFolderRouter(basePath: string = "/folders") {
  const meta = service.getMetadata?.();
  const tags = [["Folder", ...(meta?.tags || [])].join(" ")];
  const docs = service.getDocs({ tags });

  const app = new Elysia({
    name: "folderRouter",
    prefix: basePath,
  })
    .use(plugins.urlQuery)
    .use(plugins.authProfile)
    .use(plugins.auditLog);

  app.get(
    "/all-parent",
    async ({ urlQuery, profile }) => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7538/ingest/c0be7527-8cd4-4507-a519-0cde98b80131",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "be4721",
          },
          body: JSON.stringify({
            sessionId: "be4721",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "folder.router.ts:50",
            message: "all-parent auth guard precheck",
            data: {
              projectCode: urlQuery.projectCode,
              hasCheckFolderAdmin: typeof (
                authHelper as Record<string, unknown>
              ).checkFolderAdmin,
              hasCheckAdmin: typeof (authHelper as Record<string, unknown>)
                .checkAdmin,
              profileId: profile?.id,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      //   authHelper.checkFolderAdmin(profile);
      authHelper.checkPermissionAny(profile, [
        Permission.FOLDERS_BROWSE_ALL,
        Permission.FOLDERS_BROWSE_ASSIGNED,
      ]);
      const scope = await resolveFolderBrowseScope(
        profile,
        urlQuery.projectCode,
      );
      return await service.listAllParents(scope);
    },
    {
      detail: {
        tags,
        summary: "List root folders",
        description:
          "Returns root folders (parentId is null). Requires folder browse permission (folders.browse_all or folders.browse_assigned). Optional projectCode filters by project; browse_assigned callers must manage that project.",
      },
    },
  );

  app.get(
    "/dossiers/:dossierId/files",
    async ({ params, query, profile, request }) => {
      const { securityAccessHeadersFromRequest } =
        await import("../security-level/security-enforcement.ts");
      return await service.listDossierFiles(params.dossierId, {
        actorId: profile.id,
        status: query.status,
        accessHeaders: securityAccessHeadersFromRequest(request),
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
      return await dossierService.getDossierMetadataDraft(
        params.dossierId,
        profile.id,
      );
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

  app.put(
    "/dossiers/:dossierId/metadata/summary",
    async ({ params, body, profile }) => {
      authHelper.checkPermission(
        profile,
        Permission.DOSSIERS_METADATA_SUMMARY_EDIT,
      );
      return await dossierService.saveDossierSummaryMetadata(
        params.dossierId,
        body.metadata,
        profile.id,
      );
    },
    {
      params: t.Object({ dossierId: IdParam("Dossier ID") }),
      body: submitMetadataBodySchema,
      detail: {
        tags,
        summary: "Save dossier summary metadata",
        description:
          "Lưu thông tin chung của hồ sơ (mã, trạng thái, thông tin bổ sung) khi duyệt, không chuyển bước xử lý tiếp theo. Cần quyền Sửa thông tin hồ sơ khi duyệt.",
      },
    },
  );

  app.post(
    "/metadata/export",
    async ({ body, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      const { applyWatermark, skippedFileIds } =
        await assertSecurityDownloadForFolders(
          profile,
          request,
          body.folderIds,
        );
      const meta = clientMetaFromRequest(request);
      const { stream, filename, contentType, zipPasswordSource } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "metadata",
          scope: "batch",
          resourceIds: { folderIds: body.folderIds },
          applyWatermark,
          placementId: body.placementId,
          ...meta,
        },
        () =>
          dossierService.exportApprovedMetadataByFolders(body.folderIds, {
            ...body,
            applyWatermark,
            userId: profile.id,
            skippedFileIds,
          }),
      );
      return zipStreamResponse(stream, filename, contentType, { zipPasswordSource });
    },
    {
      body: multiFolderMetadataExportBodySchema,
      detail: {
        tags,
        summary: "Export metadata ZIP for multiple folders",
        description:
          "Accepts folderIds (each includes subtree), dedupes dossiers, requires all APPROVED. " +
          "Optional placementId watermark. PDFs prefer searchable_pdf/ with fallback to raw/.",
      },
    },
  );

  app.post(
    "/metadata/export/preview",
    async ({ body, profile }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      return await dossierService.previewApprovedMetadataExportByFolders(
        body.folderIds,
        body,
      );
    },
    {
      body: multiFolderMetadataExportBodySchema,
      detail: {
        tags,
        summary: "Preview metadata export for multiple folders",
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
      return await dossierService.previewApprovedMetadataExportByFolder(
        params.id,
        body,
      );
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
    async ({ params, body, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      const { applyWatermark, skippedFileIds } =
        await assertSecurityDownloadForFolders(profile, request, [params.id]);
      const meta = clientMetaFromRequest(request);
      const { stream, filename, contentType, zipPasswordSource } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "metadata",
          scope: "folder",
          resourceIds: { folderIds: [params.id] },
          applyWatermark,
          placementId: body.placementId,
          ...meta,
        },
        () =>
          dossierService.exportApprovedMetadataByFolder(params.id, {
            ...body,
            applyWatermark,
            userId: profile.id,
            skippedFileIds,
          }),
      );
      return zipStreamResponse(stream, filename, contentType, { zipPasswordSource });
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
    async ({ params, query, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      const { applyWatermark, skippedFileIds } =
        await assertSecurityDownloadForFolders(profile, request, [params.id]);
      const meta = clientMetaFromRequest(request);
      const { stream, filename, contentType, zipPasswordSource } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "metadata",
          scope: "folder",
          resourceIds: { folderIds: [params.id] },
          applyWatermark,
          placementId: query.placementId,
          ...meta,
        },
        () =>
          dossierService.exportApprovedMetadataByFolder(params.id, {
            placementId: query.placementId,
            applyWatermark,
            userId: profile.id,
            dossierAccessPassword: query.dossierAccessPassword,
            skippedFileIds,
          }),
      );
      return zipStreamResponse(stream, filename, contentType, { zipPasswordSource });
    },
    {
      params: t.Object({ id: IdParam("Folder ID") }),
      query: t.Object({
        placementId: t.Optional(t.String({ format: "uuid" })),
        applyWatermark: t.Optional(t.Boolean()),
        dossierAccessPassword: t.Optional(
          t.String({ minLength: 1, maxLength: 128 }),
        ),
      }),
      detail: {
        tags,
        summary: "Export bộ hồ sơ metadata (ZIP)",
        description:
          "Trả về ZIP: một file Excel tổng hợp metadata động ở gốc (mỗi hồ sơ một dòng) và PDF theo từng hồ sơ trong thư mục con `{ho_so}/pdfs/`. " +
          "Yêu cầu: mọi hồ sơ trong bộ (gồm thư mục con) phải APPROVED và có currentMetadataKey. Optional query placementId applies one watermark placement.",
      },
    },
  );

  app.get(
    "/:id/all-first-subfolders",
    async ({ params, urlQuery, profile }) => {
      authHelper.checkPermissionAny(profile, [
        Permission.FOLDERS_BROWSE_ALL,
        Permission.FOLDERS_BROWSE_ASSIGNED,
      ]);
      const scope = await resolveFolderBrowseScope(
        profile,
        urlQuery.projectCode,
      );
      return await service.listAllFirstSubfolders(params.id, scope);
    },
    {
      params: t.Object({ id: IdParam("Folder ID") }),
      detail: {
        tags,
        summary: "List first-level children of a folder",
        description:
          "Returns subfolders when present; otherwise returns dossiers in the folder. Requires folder browse permission (folders.browse_all or folders.browse_assigned). When projectCode is provided the result is scoped to that project (browse_assigned callers must manage it). Without projectCode, folders.browse_all returns the whole system while folders.browse_assigned returns only projects the caller manages. Every subfolder includes isAssigned, computed recursively: true only when every dossier in that subfolder and all nested subfolders is assigned (assignedGroupId or a non-TRANSFERRED dossier assignment). Subfolders may also include dossierId and status from a direct dossier on the same folderId. Each child and the response include totalSizeKb (KB) summed recursively from all nested subfolders and dossier files.",
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

  app.put(
    "/:id/project",
    async ({ params, body, profile }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
      const record = await service.assignProject(params.id, body);
      return { record, status: "updated" };
    },
    {
      params: t.Object({ id: IdParam("Folder ID") }),
      body: assignFolderProjectBodySchema,
      detail: {
        tags,
        summary: "Gán hoặc đổi dự án cho thư mục",
        description:
          "Gán projectCode cho thư mục và toàn bộ thư mục con, đồng thời cập nhật hồ sơ bên trong. " +
          "Không cho phép khi thư mục hoặc cây con đã có phân công (assignedGroupId hoặc assignment đang active). " +
          "Không áp dụng cho thư mục gốc raw/ dùng chung.",
      },
    },
  );

  app.post(
    "/:id/revoke-assignments",
    async ({ params, profile }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_ASSIGN);
      const result = await dossierService.revokeByFolderId(
        params.id,
        profile.id,
      );
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
