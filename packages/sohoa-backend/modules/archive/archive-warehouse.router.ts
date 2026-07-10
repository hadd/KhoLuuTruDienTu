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
