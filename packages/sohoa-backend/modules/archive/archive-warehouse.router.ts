import { Elysia, t } from "elysia"
import { httpError } from "@shared/common-lib"
import { createAuditLogPlugin } from "../../libs/plugins/audit-log.ts"
import { plugins } from "../../libs/plugins/_index.ts"
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts"
import { ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS, hasArchiveWarehousePermission } from "./archive-warehouse-permissions.ts"
import { ArchiveWarehouseService, WAREHOUSE_DOSSIER_STATUSES } from "./archive-warehouse-service.ts"

const tags = ["Archive Warehouse"]

const warehouseStatusSchema = t.Union(
  WAREHOUSE_DOSSIER_STATUSES.map((status) => t.Literal(status)),
)

/** Quyền vận hành kho: read/search/edit/delete/reupload (không dùng archive.permissions.manage). */
function checkWarehousePermission(profile: UserWithRoles) {
  const allowed = ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS.some((permission) => hasArchiveWarehousePermission(profile, permission))
  if (!allowed) {
    throw httpError.forbidden(
      `One of these permissions required: ${ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS.join(", ")}`,
    )
  }
}

export function createArchiveWarehouseRouter(basePath: string = "/archive-warehouse") {
  return new Elysia({ name: "archiveWarehouseRouter", prefix: basePath })
    .use(plugins.urlQuery)
    .use(plugins.authProfile)
    .get(
      "/fonds",
      async ({ profile }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.listFonds(profile)
      },
      {
        detail: {
          tags,
          summary: "Danh sách phông trong phạm vi quyền kho",
        },
      },
    )
    .get(
      "/dossier-types",
      async ({ profile }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.listDossierTypes(profile)
      },
      {
        detail: {
          tags,
          summary: "Danh sách loại hồ sơ xuất hiện trong kho (phạm vi ACL)",
        },
      },
    )
    .get(
      "/document-types",
      async ({ profile }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.listDocumentTypes(profile)
      },
      {
        detail: {
          tags,
          summary: "Danh sách loại tài liệu (phạm vi ACL / catalog)",
        },
      },
    )
    .get(
      "/fonds/:fondId/summary",
      async ({ profile, params, urlQuery }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.getFondSummary(
          profile,
          params.fondId,
          urlQuery.status,
        )
      },
      {
        params: t.Object({
          fondId: t.String({ minLength: 1 }),
        }),
        query: t.Object({
          status: t.Optional(warehouseStatusSchema),
        }),
        detail: {
          tags,
          summary: "Thống kê hồ sơ đã lưu kho theo phông",
        },
      },
    )
    .get(
      "/dossiers/unassigned",
      async ({ profile, urlQuery }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.browseUnassignedDossiers(profile, {
          page: urlQuery.page != null ? Number(urlQuery.page) : undefined,
          limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
          search: urlQuery.search,
          status: urlQuery.status,
        })
      },
      {
        detail: {
          tags,
          summary: "Danh sách hồ sơ đã lưu kho chưa thuộc phông",
        },
      },
    )
    .get(
      "/dossiers",
      async ({ profile, urlQuery }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.browseDossiers(profile, {
          page: urlQuery.page != null ? Number(urlQuery.page) : undefined,
          limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
          fondId: urlQuery.fondId,
          search: urlQuery.search,
          year: urlQuery.year != null ? Number(urlQuery.year) : undefined,
          status: urlQuery.status,
        })
      },
      {
        detail: {
          tags,
          summary: "Duyệt hồ sơ đã lưu kho theo phông",
          description:
            "Bắt buộc fondId. Chỉ trả về hồ sơ trong kho theo phạm vi phân quyền. Hỗ trợ lọc năm (inventory.submissionYear), tìm kiếm và phân trang.",
        },
      },
    )
    .group("", (searchApp) =>
      searchApp
        .onBeforeHandle(({ request }) => {
          const mode = new URL(request.url).searchParams.get("mode")
          ;(request as Request & { __auditAction?: string }).__auditAction = mode === "content"
            ? "search-archive-warehouse-content"
            : "search-archive-warehouse"
        })
        .use(createAuditLogPlugin({ logResponseBody: false }))
        .get(
          "/search",
          async ({ profile, urlQuery }) => {
            checkWarehousePermission(profile)
            const mode = urlQuery.mode === "content" ? "content" : "metadata"

            if (mode === "content") {
              return await ArchiveWarehouseService.searchContent(profile, {
                q: urlQuery.q ?? urlQuery.search,
                fondId: urlQuery.fondId,
                limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset != null ? Number(urlQuery.offset) : undefined,
                groupCode: urlQuery.groupCode,
                trangThaiHoSo: urlQuery.trangThaiHoSo,
                dossierTypeId: urlQuery.dossierTypeId,
                documentTypeId: urlQuery.documentTypeId,
                editorName: urlQuery.editorName,
                editCompletedAtFrom: urlQuery.editCompletedAtFrom,
                editCompletedAtTo: urlQuery.editCompletedAtTo,
                archivedAtFrom: urlQuery.archivedAtFrom,
                archivedAtTo: urlQuery.archivedAtTo,
              })
            }

            return await ArchiveWarehouseService.searchMetadata(profile, {
              dossierName: urlQuery.dossierName ?? urlQuery.q,
              documentName: urlQuery.documentName,
              fondId: urlQuery.fondId,
              dossierTypeId: urlQuery.dossierTypeId,
              documentTypeId: urlQuery.documentTypeId,
              editorName: urlQuery.editorName,
              editCompletedAtFrom: urlQuery.editCompletedAtFrom,
              editCompletedAtTo: urlQuery.editCompletedAtTo,
              archivedAtFrom: urlQuery.archivedAtFrom,
              archivedAtTo: urlQuery.archivedAtTo,
              limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
              offset: urlQuery.offset != null ? Number(urlQuery.offset) : undefined,
            })
          },
          {
            detail: {
              tags,
              summary: "Tra cứu hồ sơ kho (metadata AND hoặc OCR content)",
              description:
                "mode=metadata (mặc định): AND các tiêu chí tên HS/tài liệu, phông, loại HS, loại tài liệu, biên tập, khoảng ngày. mode=content: nested OCR full-text (q bắt buộc) + cùng bộ filter AND.",
            },
          },
        ))
    .patch(
      "/dossiers/:dossierId/files/:fileId/document-type",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.updateFileDocumentType(profile, {
          dossierId: params.dossierId,
          fileId: params.fileId,
          documentTypeId: body.documentTypeId ?? null,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          documentTypeId: t.Union([t.String({ minLength: 1 }), t.Null()]),
        }),
        detail: {
          tags,
          summary: "Gán / gỡ loại tài liệu cho file trong hồ sơ kho",
        },
      },
    )
    .post(
      "/dossiers/:dossierId/files/:fileId/reupload-upload-point",
      async ({ profile, params }) => {
        return await ArchiveWarehouseService.createReuploadUploadPoint(profile, {
          dossierId: params.dossierId,
          fileId: params.fileId,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        detail: {
          tags,
          summary: "Tạo điểm upload PDF thay file trong hồ sơ kho",
        },
      },
    )
    .post(
      "/dossiers/:dossierId/files/:fileId/reupload",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.reuploadFile(profile, {
          dossierId: params.dossierId,
          fileId: params.fileId,
          key: body?.key,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        body: t.Optional(t.Object({
          key: t.Optional(t.String({ minLength: 1 })),
        })),
        detail: {
          tags,
          summary: "Thay file trong hồ sơ kho và mở lại OCR (status NEW)",
          description: "Giữ nguyên dossierId. Cập nhật file (nếu có key), xóa metadata processed cũ cùng path tên hồ sơ, clear OCR keys, status NEW.",
        },
      },
    )
    .delete(
      "/dossiers/:dossierId/files/:fileId",
      async ({ profile, params }) => {
        return await ArchiveWarehouseService.deleteFile(profile, {
          dossierId: params.dossierId,
          fileId: params.fileId,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        detail: {
          tags,
          summary: "Xóa file trong hồ sơ kho và mở lại OCR",
        },
      },
    )
    .post(
      "/dossiers/:dossierId/files/bulk-delete",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.deleteFiles(profile, {
          dossierId: params.dossierId,
          fileIds: body.fileIds,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          fileIds: t.Array(
            t.String({ format: "uuid" }),
            { minItems: 1, maxItems: 100 },
          ),
        }),
        detail: {
          tags,
          summary: "Xóa nhiều file trong hồ sơ kho và mở lại OCR",
        },
      },
    )
    .post(
      "/dossiers/:dossierId/files/:fileId/move",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.moveFile(profile, {
          dossierId: params.dossierId,
          fileId: params.fileId,
          targetDossierId: body.targetDossierId,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          targetDossierId: t.String({ format: "uuid" }),
        }),
        detail: {
          tags,
          summary: "Chuyển file sang hồ sơ kho khác và mở lại OCR cả hai hồ sơ",
        },
      },
    )
    .post(
      "/dossiers/:dossierId/files/bulk-move",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.moveFiles(profile, {
          dossierId: params.dossierId,
          fileIds: body.fileIds,
          targetDossierId: body.targetDossierId,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          fileIds: t.Array(
            t.String({ format: "uuid" }),
            { minItems: 1, maxItems: 100 },
          ),
          targetDossierId: t.String({ format: "uuid" }),
        }),
        detail: {
          tags,
          summary: "Chuyển nhiều file sang hồ sơ khác và mở lại OCR cả hai hồ sơ",
        },
      },
    )
    .group("", (app) =>
      app
        .onBeforeHandle(({ request }) => {
          ;(request as Request & { __auditAction?: string }).__auditAction = "view-archive-warehouse-dossier"
        })
        .use(createAuditLogPlugin({ logResponseBody: false }))
        .get(
          "/dossiers/:id",
          async ({ profile, params }) => {
            checkWarehousePermission(profile)
            return await ArchiveWarehouseService.getDossierDetail(
              profile,
              params.id,
            )
          },
          {
            params: t.Object({
              id: t.String({ format: "uuid" }),
            }),
            detail: {
              tags,
              summary: "Xem chi tiết hồ sơ đã lưu kho (chỉ đọc)",
            },
          },
        ))
}
