import { Elysia, t } from "elysia"
import { httpError } from "@shared/common-lib"
import { createAuditLogPlugin } from "../../libs/plugins/audit-log.ts"
import { plugins } from "../../libs/plugins/_index.ts"
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts"
import { ARCHIVE_WAREHOUSE_ACCESS_PERMISSIONS, hasArchiveWarehousePermission } from "./archive-warehouse-permissions.ts"
import { ArchiveWarehouseService, WAREHOUSE_DOSSIER_STATUSES } from "./archive-warehouse-service.ts"
import { securityAccessHeadersFromRequest } from "../security-level/security-enforcement.ts"

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
    .use(plugins.auditLog)
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
      "/dossier-types/:dossierTypeId/summary",
      async ({ profile, params, urlQuery }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.getDossierTypeSummary(
          profile,
          params.dossierTypeId,
          urlQuery.status,
        )
      },
      {
        params: t.Object({
          dossierTypeId: t.String({ minLength: 1 }),
        }),
        query: t.Object({
          status: t.Optional(warehouseStatusSchema),
        }),
        detail: {
          tags,
          summary: "Thống kê hồ sơ đã lưu kho theo loại hồ sơ",
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
      "/document-types/:documentTypeId/summary",
      async ({ profile, params }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.getDocumentTypeSummary(
          profile,
          params.documentTypeId,
        )
      },
      {
        params: t.Object({
          documentTypeId: t.String({ minLength: 1 }),
        }),
        detail: {
          tags,
          summary: "Thống kê tài liệu đã lưu kho theo loại tài liệu",
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
      "/dossiers/by-dossier-type",
      async ({ profile, urlQuery }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.browseDossiersByDossierType(profile, {
          page: urlQuery.page != null ? Number(urlQuery.page) : undefined,
          limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
          dossierTypeId: urlQuery.dossierTypeId,
          search: urlQuery.search,
          year: urlQuery.year != null ? Number(urlQuery.year) : undefined,
          status: urlQuery.status,
        })
      },
      {
        detail: {
          tags,
          summary: "Duyệt hồ sơ đã lưu kho theo loại hồ sơ",
          description:
            "Bắt buộc dossierTypeId. Trả về hồ sơ ARCHIVED theo loại hồ sơ trong phạm vi phân quyền.",
        },
      },
    )
    .get(
      "/documents/by-document-type",
      async ({ profile, urlQuery }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.browseDocumentsByDocumentType(profile, {
          page: urlQuery.page != null ? Number(urlQuery.page) : undefined,
          limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
          documentTypeId: urlQuery.documentTypeId,
          search: urlQuery.search,
        })
      },
      {
        detail: {
          tags,
          summary: "Duyệt tài liệu đã lưu kho theo loại tài liệu",
          description:
            "Bắt buộc documentTypeId. Trả về file trong hồ sơ ARCHIVED theo loại tài liệu trong phạm vi phân quyền.",
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
          ;(request as Request & { __auditAction?: string }).__auditAction =
            mode === "content" ? "search-archive-warehouse-content" : "search-archive-warehouse"
        })
        .use(createAuditLogPlugin({ logResponseBody: false }))
        .get(
          "/search",
          async ({ profile, urlQuery }) => {
            checkWarehousePermission(profile)
            const q = urlQuery.q ?? urlQuery.search
            const explicitMode = urlQuery.mode
            const mode = explicitMode === "content"
              ? "content"
              : explicitMode === "metadata"
              ? "metadata"
              : q?.trim()
              ? "all"
              : "metadata"

            if (mode === "content") {
              return await ArchiveWarehouseService.searchContent(profile, {
                q,
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
                searchFields: urlQuery.searchFields,
              })
            }

            if (mode === "all") {
              return await ArchiveWarehouseService.searchUnified(profile, {
                q,
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
                searchFields: urlQuery.searchFields,
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
              summary: "Tra cứu hồ sơ kho (metadata AND, unified q, hoặc OCR content)",
              description:
                "mode=all (mặc định khi có q): tên hồ sơ HOẶC nested OCR full-text + bộ filter AND. mode=metadata: AND các tiêu chí tên HS/tài liệu, phông, loại HS, loại tài liệu, biên tập, khoảng ngày. mode=content: chỉ nested OCR (q bắt buộc) + cùng bộ filter AND.",
            },
          },
        ))
    .patch(
      "/dossiers/:dossierId/files/:fileId/document-type",
      async ({ profile, params, body, request }) => {
        return await ArchiveWarehouseService.updateFileDocumentType(
          profile,
          {
            dossierId: params.dossierId,
            fileId: params.fileId,
            documentTypeId: body.documentTypeId ?? null,
            securityLevelId: body.securityLevelId,
          },
          securityAccessHeadersFromRequest(request),
        )
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          documentTypeId: t.Union([t.String({ minLength: 1 }), t.Null()]),
          securityLevelId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
        }),
        detail: {
          tags,
          summary: "Khóa — không cho sửa loại tài liệu file đã lưu kho",
        },
      },
    )
    .patch(
      "/dossiers/:dossierId/security",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.updateDossierSecurity(profile, {
          dossierId: params.dossierId,
          securityLevelId: body.securityLevelId,
          accessPassword: body.accessPassword,
          clearAccessPassword: body.clearAccessPassword,
          currentAccessPassword: body.currentAccessPassword,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          securityLevelId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
          accessPassword: t.Optional(t.String({ minLength: 1 })),
          clearAccessPassword: t.Optional(t.Boolean()),
          currentAccessPassword: t.Optional(t.String({ minLength: 1 })),
        }),
        detail: {
          tags,
          summary: "Cập nhật cấp bảo mật / mật khẩu riêng hồ sơ trong kho",
        },
      },
    )
    .patch(
      "/dossiers/:dossierId/files/:fileId/security",
      async ({ profile, params, body }) => {
        return await ArchiveWarehouseService.updateFileSecurity(profile, {
          dossierId: params.dossierId,
          fileId: params.fileId,
          securityLevelId: body.securityLevelId,
          accessPassword: body.accessPassword,
          clearAccessPassword: body.clearAccessPassword,
          currentAccessPassword: body.currentAccessPassword,
        })
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          securityLevelId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
          accessPassword: t.Optional(t.String({ minLength: 1 })),
          clearAccessPassword: t.Optional(t.Boolean()),
          currentAccessPassword: t.Optional(t.String({ minLength: 1 })),
        }),
        detail: {
          tags,
          summary: "Cập nhật cấp bảo mật / mật khẩu riêng file trong kho",
        },
      },
    )
    .post(
      "/dossiers/:dossierId/files/bulk-security",
      async ({ profile, params, body, request }) => {
        return await ArchiveWarehouseService.updateFilesSecurity(
          profile,
          {
            dossierId: params.dossierId,
            fileIds: body.fileIds,
            securityLevelId: body.securityLevelId,
            accessPassword: body.accessPassword,
            clearAccessPassword: body.clearAccessPassword,
            currentAccessPassword: body.currentAccessPassword,
          },
          securityAccessHeadersFromRequest(request),
        )
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
          securityLevelId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
          accessPassword: t.Optional(t.String({ minLength: 1 })),
          clearAccessPassword: t.Optional(t.Boolean()),
          currentAccessPassword: t.Optional(t.String({ minLength: 1 })),
        }),
        detail: {
          tags,
          summary: "Cập nhật cấp bảo mật / mật khẩu riêng cho nhiều file trong kho",
        },
      },
    )
    .get(
      "/dossiers/:dossierId/files/:fileId/content",
      async ({ profile, params, query, request }) => {
        checkWarehousePermission(profile)
        return await ArchiveWarehouseService.getFileContent(
          profile,
          {
            dossierId: params.dossierId,
            fileId: params.fileId,
            variant: query.variant,
            disposition: query.disposition,
          },
          securityAccessHeadersFromRequest(request),
        )
      },
      {
        params: t.Object({
          dossierId: t.String({ format: "uuid" }),
          fileId: t.String({ format: "uuid" }),
        }),
        query: t.Object({
          variant: t.Optional(t.Union([t.Literal("searchable"), t.Literal("original")])),
          disposition: t.Optional(t.Union([t.Literal("inline"), t.Literal("attachment")])),
        }),
        detail: {
          tags,
          summary: "Cấp URL ngắn hạn xem/tải file sau khi kiểm tra mật khẩu",
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
          "/dossiers/:dossierId",
          async ({ profile, params, request }) => {
            checkWarehousePermission(profile)
            return await ArchiveWarehouseService.getDossierDetail(
              profile,
              params.dossierId,
              securityAccessHeadersFromRequest(request),
            )
          },
          {
            params: t.Object({
              dossierId: t.String({ format: "uuid" }),
            }),
            detail: {
              tags,
              summary: "Xem chi tiết hồ sơ đã lưu kho (chỉ đọc)",
            },
          },
        ))
}
