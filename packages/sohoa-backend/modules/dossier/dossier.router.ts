import { Elysia, t } from "elysia";
import { httpError, IdParam } from "@shared/common-lib";
import { DossierService as service } from "./dossier-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
  canDownloadOriginal,
  canDownloadWatermark,
} from "../archive/archive-warehouse-permissions.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import {
  assignByFolderIdBodySchema,
  assignDossierBodySchema,
  checkFilePathQuerySchema,
  createDocumentFromStorageBodySchema,
  createUploadPointBodySchema,
  listAssignmentsByRoleQuerySchema,
  listAssignmentsByRoleResponseSchema,
  listDraftAssignmentsResponseSchema,
} from "./types.ts";
import {
  bulkSubmitDraftBodySchema,
  bulkSubmitDraftResponseSchema,
  draftMetadataResponseSchema,
  submitMetadataBodySchema,
} from "../data-entry/types.ts";
import { isPermanentDeleteFlag } from "./dossier-delete-utils.ts";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";
import { zipStreamResponse } from "../../libs/zip-stream-response.ts";
import {
  clientMetaFromRequest,
  withDownloadLog,
} from "../download/download-log-service.ts";

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
});

const multiDossierMetadataExportBodySchema = t.Object({
  dossierIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
  presetId: t.Optional(t.String({ format: "uuid" })),
  columns: t.Optional(t.Array(metadataExportColumnSchema, { minItems: 1 })),
  placementId: t.Optional(t.String({ format: "uuid" })),
  applyWatermark: t.Optional(t.Boolean()),
});

const multiDipExportBodySchema = t.Object({
  dossierIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
  placementId: t.Optional(t.String({ format: "uuid" })),
  applyWatermark: t.Optional(t.Boolean()),
});

/**
 * Watermark chủ động hoặc placementId cũ → cần download_watermark.
 * Không áp watermark → cần download_original.
 */
function checkDownloadPermission(
  profile: UserWithRoles,
  placementId: string | undefined,
  applyWatermark: boolean | undefined,
): void {
  if (placementId || applyWatermark) {
    if (!canDownloadWatermark(profile)) {
      throw httpError.forbidden("Yêu cầu quyền tải xuống bản có watermark");
    }
  } else {
    if (!canDownloadOriginal(profile)) {
      throw httpError.forbidden("Yêu cầu quyền tải xuống bản gốc");
    }
  }
}

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
        description:
          "Returns exists: false when no dossier file record matches the path.",
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
      authHelper.checkDossierWorkflowDataAccess(profile);
      return await service.listAssignmentsByRole(profile.id, query);
    },
    {
      query: listAssignmentsByRoleQuerySchema,
      response: listAssignmentsByRoleResponseSchema,
      detail: {
        tags,
        summary: "List my dossier assignments by role",
        description:
          "Returns dossier assignments of the logged-in user for a worker role (MAKER, CHECKER_1, …). Each dossier includes files with filePath, fullPath, searchablePdfPath, searchablePdfFullPath, and currentMetadataUrl (draft metadata when status is DRAFT). For CHECKER roles, each assignment also includes issueReports (open document issue reports from editors). Optional filter: status.",
      },
    },
  );

  app.get(
    "/assignments/drafts",
    async ({ profile }) => {
      authHelper.checkDossierWorkflowDataAccess(profile);
      return await service.listDraftAssignments(profile.id);
    },
    {
      response: listDraftAssignmentsResponseSchema,
      detail: {
        tags,
        summary: "List my draft dossier assignments",
        description:
          "Returns all dossier assignments in DRAFT status for the logged-in user (MAKER and CHECKER roles). Each item includes currentMetadataUrl pointing to the assignment-scoped draft metadata file.",
      },
    },
  );

  app.post(
    "/assignments/drafts/submit",
    async ({ body, profile }) => {
      return await service.bulkSubmitDraftAssignments(profile.id, body.items);
    },
    {
      body: bulkSubmitDraftBodySchema,
      response: bulkSubmitDraftResponseSchema,
      detail: {
        tags,
        summary: "Bulk submit draft dossier assignments",
        description:
          "Gửi đi / duyệt đồng loạt các hồ sơ đang DRAFT. Tự nhận MAKER (SUBMIT_ENTRY) hoặc CHECKER (APPROVE) theo phân công. Trả về danh sách thành công và thất bại từng hồ sơ.",
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

  app.post(
    "/metadata/export",
    async ({ body, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      checkDownloadPermission(profile, body.placementId, body.applyWatermark);
      const meta = clientMetaFromRequest(request);
      const applyWatermark = Boolean(body.placementId || body.applyWatermark);
      const { stream, filename, contentType } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "metadata",
          scope: "batch",
          resourceIds: { dossierIds: body.dossierIds },
          applyWatermark,
          placementId: body.placementId,
          ...meta,
        },
        () =>
          service.exportMetadataExcelByIds(body.dossierIds, {
            ...body,
            userId: profile.id,
          }),
      );
      return zipStreamResponse(stream, filename, contentType);
    },
    {
      body: multiDossierMetadataExportBodySchema,
      detail: {
        tags,
        summary: "Export metadata ZIP for multiple dossiers",
        description:
          "Accepts dossierIds and optional placementId. Returns one ZIP with Excel + PDFs; " +
          "PDFs are read from searchable_pdf/ (fallback raw/). Watermark applies when placementId is set.",
      },
    },
  );

  app.post(
    "/dip/export",
    async ({ body, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      checkDownloadPermission(profile, body.placementId, body.applyWatermark);
      const meta = clientMetaFromRequest(request);
      const applyWatermark = Boolean(body.placementId || body.applyWatermark);
      const { stream, filename, contentType } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "dip",
          scope: "batch",
          resourceIds: { dossierIds: body.dossierIds },
          applyWatermark,
          placementId: body.placementId,
          ...meta,
        },
        () =>
          service.exportDipHosoBatch(body.dossierIds, {
            placementId: body.placementId,
            applyWatermark: body.applyWatermark,
            userId: profile.id,
          }),
      );
      return zipStreamResponse(stream, filename, contentType);
    },
    {
      body: multiDipExportBodySchema,
      detail: {
        tags,
        summary: "Export DIP ZIP for multiple dossiers",
        description:
          "Accepts dossierIds and optional placementId watermark. One dossier keeps flat DIP layout; " +
          "multiple dossiers return multi-dip-export.zip with {hoSoId}/hoso.xml + documents/.",
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
        permanent: t.Optional(
          t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")], {
            description:
              "When true, permanently deletes the dossier from the database and MinIO. Default is soft delete (deletedAt only).",
          }),
        ),
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
    "/:id/dip/export",
    async ({ params, query, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      checkDownloadPermission(profile, query.placementId, query.applyWatermark);
      const meta = clientMetaFromRequest(request);
      const applyWatermark = Boolean(query.placementId || query.applyWatermark);
      const { stream, filename, contentType } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "dip",
          scope: "dossier",
          resourceIds: { dossierIds: [params.id] },
          applyWatermark,
          placementId: query.placementId,
          ...meta,
        },
        () =>
          service.exportDipHoso(params.id, {
            placementId: query.placementId,
            applyWatermark: query.applyWatermark,
            userId: profile.id,
          }),
      );
      return zipStreamResponse(stream, filename, contentType);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      query: t.Object({
        placementId: t.Optional(t.String({ format: "uuid" })),
        applyWatermark: t.Optional(t.Boolean()),
      }),
      detail: {
        tags,
        summary: "Export DIP_hoso (Dissemination Information Package)",
        description:
          "Generates a DIP_hoso ZIP on-demand for an approved dossier. " +
          "Contains hoso.xml and PDF documents for user dissemination (Thông tư 05/2025 Phụ lục V). " +
          "Optional query placementId applies one watermark placement to PDFs. " +
          "PDFs prefer searchable_pdf/ with fallback to raw/.",
      },
    },
  );

  app.get(
    "/:id/aip/status",
    async ({ params, profile }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      return await service.getAipStatus(params.id);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      detail: {
        tags,
        summary: "Check AIP_hoso archival package status",
        description:
          "Returns whether the WORM AIP package exists on MinIO for an approved dossier, " +
          "including size, lastModified, and a presigned download URL when available.",
      },
    },
  );

  app.get(
    "/:id/metadata/export/fields",
    async ({ params, profile }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      return await service.getDossierMetadataExportFields(params.id);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      detail: {
        tags,
        summary: "List exportable metadata fields for a dossier",
      },
    },
  );

  app.post(
    "/:id/metadata/export/preview",
    async ({ params, body, profile }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      return await service.previewDossierMetadataExport(params.id, body);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      body: metadataExportBodySchema,
      detail: {
        tags,
        summary: "Preview dossier metadata export",
      },
    },
  );

  app.post(
    "/:id/metadata/export",
    async ({ params, body, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      checkDownloadPermission(profile, body.placementId, body.applyWatermark);
      const meta = clientMetaFromRequest(request);
      const applyWatermark = Boolean(body.placementId || body.applyWatermark);
      const { stream, filename, contentType } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "metadata",
          scope: "dossier",
          resourceIds: { dossierIds: [params.id] },
          applyWatermark,
          placementId: body.placementId,
          ...meta,
        },
        () =>
          service.exportMetadataExcel(params.id, {
            ...body,
            userId: profile.id,
          }),
      );
      return zipStreamResponse(stream, filename, contentType);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      body: metadataExportBodySchema,
      detail: {
        tags,
        summary: "Export dossier metadata with column configuration",
      },
    },
  );

  app.get(
    "/:id/metadata/export",
    async ({ params, query, profile, request }) => {
      authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
      checkDownloadPermission(profile, query.placementId, query.applyWatermark);
      const meta = clientMetaFromRequest(request);
      const applyWatermark = Boolean(query.placementId || query.applyWatermark);
      const { stream, filename, contentType } = await withDownloadLog(
        {
          userId: profile.id,
          exportType: "metadata",
          scope: "dossier",
          resourceIds: { dossierIds: [params.id] },
          applyWatermark,
          placementId: query.placementId,
          ...meta,
        },
        () =>
          service.exportMetadataExcel(params.id, {
            placementId: query.placementId,
            applyWatermark: query.applyWatermark,
            userId: profile.id,
          }),
      );
      return zipStreamResponse(stream, filename, contentType);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      query: t.Object({
        placementId: t.Optional(t.String({ format: "uuid" })),
        applyWatermark: t.Optional(t.Boolean()),
      }),
      detail: {
        tags,
        summary: "Export dossier metadata to Excel (dynamic default columns)",
        description:
          "Downloads the current metadata JSON from MinIO, generates a dynamic Excel file (one column per field, header = field name), bundles all related PDF documents, and returns a ZIP archive. Optional query placementId applies one watermark placement to PDFs.",
      },
    },
  );

  app.put(
    "/:id/metadata/draft",
    async ({ params, body, profile }) => {
      return await service.saveMetadataDraft(
        params.id,
        body.metadata,
        profile.id,
      );
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      body: submitMetadataBodySchema,
      response: draftMetadataResponseSchema,
      detail: {
        tags,
        summary: "Save metadata draft",
        description:
          "Lưu nháp metadata theo từng phân công. Tối đa 10 hồ sơ nháp/người. Đặt assignment status DRAFT, không đổi trạng thái hồ sơ. Bản nháp bị xóa khi phân công tương ứng gửi đi hoặc duyệt.",
      },
    },
  );

  app.get(
    "/:id/metadata/draft",
    async ({ params, profile }) => {
      return await service.getDossierMetadataDraft(params.id, profile.id);
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      detail: {
        tags,
        summary: "Get metadata draft",
        description:
          "Loads the logged-in editor/checker's assignment-scoped draft metadata JSON.",
      },
    },
  );

  app.put(
    "/:id/metadata",
    async ({ params, body, profile }) => {
      await authHelper.checkWorkflowAccess(profile, {
        permission: Permission.DATA_ENTRY_MAKER,
        workerRoles: [WorkerRole.MAKER],
        dossierId: params.id,
      });
      return await service.saveDossierMetadata(
        params.id,
        body.metadata,
        profile.id,
        body.issue_report,
      );
    },
    {
      params: t.Object({ id: IdParam("Dossier ID") }),
      body: submitMetadataBodySchema,
      detail: {
        tags,
        summary: "Save dossier metadata",
        description:
          "Uploads the edited JSON metadata to MinIO, marks the MAKER assignment COMPLETED, moves the dossier to WAITING_CHECKER_1 (or APPROVED / WAITING_ISSUE_RESOLUTION when requiredQcCount is 0), and logs SUBMIT_ENTRY. Returns the new presigned currentMetadataUrl.",
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
