import { Elysia, t } from "elysia";
import { createAuditLogPlugin } from "../../libs/plugins/audit-log.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { ARCHIVE_WAREHOUSE_SEARCH_PERMISSIONS } from "../archive/archive-warehouse-permissions.ts";
import { SearchService } from "./search-service.ts";

export function createSearchRouter(basePath: string = "/search") {
    const tags = ["Search"];

    return new Elysia({ name: "searchRouter", prefix: basePath })
        .use(plugins.authProfile)
        .onBeforeHandle(({ request }) => {
            (request as Request & { __auditAction?: string }).__auditAction = "search-fulltext";
        })
        .use(createAuditLogPlugin({ logResponseBody: true, maxResponseBodySize: 1000 }))
        .get("/", async ({ profile, query }) => {
            authHelper.checkPermissionAny(profile, [
                ...ARCHIVE_WAREHOUSE_SEARCH_PERMISSIONS,
            ]);
            return SearchService.search(profile, {
                q: query.q,
                types: query.types,
                limit: query.limit,
                offset: query.offset,
                fondId: query.fondId,
                groupCode: query.groupCode,
                trangThaiHoSo: query.trangThaiHoSo,
            });
        }, {
            query: t.Object({
                q: t.Optional(t.String()),
                types: t.Optional(t.String()),
                limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
                offset: t.Optional(t.Numeric({ minimum: 0 })),
                fondId: t.Optional(t.String()),
                groupCode: t.Optional(t.String()),
                trangThaiHoSo: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "Tìm kiếm toàn văn trong kho dữ liệu",
            },
        });
}
