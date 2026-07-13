import { Elysia, t } from "elysia";
import { createAuditLogPlugin } from "../../libs/plugins/audit-log.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    ArchiveWarehouseService,
    WAREHOUSE_DOSSIER_STATUSES,
} from "./archive-warehouse-service.ts";

const tags = ["Archive Warehouse"];

const warehousePermissions = [
    Permission.ARCHIVE_WAREHOUSE_READ,
    Permission.ARCHIVE_WAREHOUSE_MANAGE,
    Permission.SEARCH_GLOBAL,
] as const;

const warehouseStatusSchema = t.Union(
    WAREHOUSE_DOSSIER_STATUSES.map((status) => t.Literal(status)),
);

function checkWarehousePermission(profile: Parameters<typeof authHelper.checkPermissionAny>[0]) {
    authHelper.checkPermissionAny(profile, [...warehousePermissions]);
}

export function createArchiveWarehouseRouter(basePath: string = "/archive-warehouse") {
    return new Elysia({ name: "archiveWarehouseRouter", prefix: basePath })
        .use(plugins.urlQuery)
        .use(plugins.authProfile)
        .get(
            "/fonds/:fondId/summary",
            async ({ profile, params, urlQuery }) => {
                checkWarehousePermission(profile);
                return await ArchiveWarehouseService.getFondSummary(
                    profile,
                    params.fondId,
                    urlQuery.status,
                );
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
            "/dossiers",
            async ({ profile, urlQuery }) => {
                checkWarehousePermission(profile);
                return await ArchiveWarehouseService.browseDossiers(profile, {
                    page: urlQuery.page != null ? Number(urlQuery.page) : undefined,
                    limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
                    fondId: urlQuery.fondId,
                    search: urlQuery.search,
                    year: urlQuery.year != null ? Number(urlQuery.year) : undefined,
                    status: urlQuery.status,
                });
            },
            {
                detail: {
                    tags,
                    summary: "Duyệt hồ sơ đã lưu kho theo phông",
                    description:
                        "Bắt buộc fondId. Chỉ trả về hồ sơ trong kho theo phạm vi phân quyền. Hỗ trợ lọc năm (inventory.submissionYear), trạng thái, tìm kiếm và phân trang.",
                },
            },
        )
        .get(
            "/search",
            async ({ profile, urlQuery }) => {
                checkWarehousePermission(profile);
                return await ArchiveWarehouseService.searchContent(profile, {
                    q: urlQuery.q ?? urlQuery.search,
                    fondId: urlQuery.fondId,
                    limit: urlQuery.limit != null ? Number(urlQuery.limit) : undefined,
                    offset: urlQuery.offset != null ? Number(urlQuery.offset) : undefined,
                });
            },
            {
                detail: {
                    tags,
                    summary: "Tìm kiếm toàn văn nội dung hồ sơ đã lưu kho",
                    description:
                        "Tìm trong tiêu đề và nội dung OCR/metadata của hồ sơ đã lưu kho (Elasticsearch), theo phạm vi phông được phân quyền.",
                },
            },
        )
        .post(
            "/dossiers/:dossierId/files/:fileId/reupload-upload-point",
            async ({ profile, params }) => {
                return await ArchiveWarehouseService.createReuploadUploadPoint(profile, {
                    dossierId: params.dossierId,
                    fileId: params.fileId,
                });
            },
            {
                params: t.Object({
                    dossierId: t.String({ format: "uuid" }),
                    fileId: t.String({ format: "uuid" }),
                }),
                detail: {
                    tags,
                    summary: "Tạo điểm upload để đưa lại file vào quy trình raw",
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
                });
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
                    summary: "Upload lại file vào kho (raw → OCR → biên tập → duyệt)",
                    description:
                        "Sao chép file đã lưu kho vào raw/ (hoặc đăng ký key đã upload) để tạo hồ sơ mới đi lại quy trình số hóa.",
                },
            },
        )
        .group("", (app) =>
            app
                .onBeforeHandle(({ request }) => {
                    (request as Request & { __auditAction?: string }).__auditAction =
                        "view-archive-warehouse-dossier";
                })
                .use(createAuditLogPlugin({ logResponseBody: false }))
                .get(
                    "/dossiers/:id",
                    async ({ profile, params }) => {
                        checkWarehousePermission(profile);
                        return await ArchiveWarehouseService.getDossierDetail(
                            profile,
                            params.id,
                        );
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
                )
        );
}
