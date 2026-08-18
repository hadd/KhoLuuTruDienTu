// @/features/dashboard/dashboard.warehouse-router.ts

import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { DashboardService as service } from "./dashboard-service.ts";
import { ItemService } from "../physical-warehouse/physical-warehouse-service.ts";
import { PlacementService } from "../physical-warehouse/physical-placement-service.ts";
import { FondService } from "../fond/fond-service.ts";
import {
    warehouseLocationResponseSchema,
    warehouseStatsResponseSchema,
    warehouseUnplacedResponseSchema,
    warehouseActiveFondsResponseSchema,
    warehouseBorrowStatsResponseSchema,
    warehouseDisposalResponseSchema,
} from "./types.ts";

const tags = ["Dashboard", "Warehouse"];

export function createDashboardWarehouseRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardWarehouseRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.auditLog);

    const checkWarehousePermission = (profile: any) => {
        const requiredPermission = 
            (Permission as any).DASHBOARD_WAREHOUSE ?? 
            Permission.PHYSICAL_WAREHOUSE_ITEM_READ ?? 
            Permission.DASHBOARD_ADMIN;
        authHelper.checkPermission(profile, requiredPermission);
    };

    app.get(
        "/warehouse/locations",
        async ({ profile }) => {
            checkWarehousePermission(profile);
            const { items: roots } = await ItemService.list({ parentId: null });
            return await Promise.all(
                roots.map(async (root) => {
                    try {
                        const { stats } = await ItemService.stats(root.id);
                        return {
                            ...root,
                            capacity: stats.totalCapacity,
                            usedCapacity: stats.usedCapacity,
                            childCount: stats.bottomLevelCount,
                        };
                    } catch {
                        return { ...root, capacity: 0, usedCapacity: 0, childCount: 0 };
                    }
                })
            );
        },
        {
            response: warehouseLocationResponseSchema,
            detail: { tags, summary: "Lấy danh sách địa điểm kho kèm sức chứa đã cấu hình" }
        }
    );

    app.get(
        "/warehouse/stats",
        async ({ profile, query }) => {
            checkWarehousePermission(profile);
            return await service.getWarehouseStats(query.chartGranularity ?? "month");
        },
        {
            query: t.Object({
                chartGranularity: t.Optional(t.Union([t.Literal("day"), t.Literal("month"), t.Literal("year")])),
            }),
            response: warehouseStatsResponseSchema,
            detail: { tags, summary: "Lấy số liệu tổng quan và biểu đồ tăng trưởng số hóa nạp kho" }
        }
    );

    app.get(
        "/warehouse/unplaced",
        async ({ profile }) => {
            checkWarehousePermission(profile);
            return await PlacementService.listUnplacedArchived({ page: 1, limit: 5 });
        },
        {
            response: warehouseUnplacedResponseSchema,
            detail: { tags, summary: "Lấy danh sách hồ sơ vật lý chưa được cấu hình vị trí" }
        }
    );

    app.get(
        "/warehouse/active-fonds",
        async ({ profile }) => {
            checkWarehousePermission(profile);
            return await FondService.listActiveWithDossierCount();
        },
        {
            response: warehouseActiveFondsResponseSchema,
            detail: { tags, summary: "Lấy danh sách phông lưu trữ hoạt động kèm số lượng hồ sơ" }
        }
    );

    app.get(
        "/warehouse/borrow-stats",
        async ({ profile }) => {
            checkWarehousePermission(profile);
            return await service.getWarehouseBorrowStats();
        },
        {
            response: warehouseBorrowStatsResponseSchema,
            detail: { tags, summary: "Lấy số liệu đếm trạng thái phiếu mượn trả hồ sơ khai thác" }
        }
    );

    app.get(
        "/warehouse/disposal-candidates",
        async ({ profile }) => {
            checkWarehousePermission(profile);
            return await service.getWarehouseDisposalCandidates();
        },
        {
            response: warehouseDisposalResponseSchema,
            detail: { tags, summary: "Lấy danh sách các hồ sơ đã đến hoặc quá hạn tiêu hủy trong kho" }
        }
    );

    return app;
}