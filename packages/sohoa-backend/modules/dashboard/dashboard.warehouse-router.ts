// @/features/dashboard/dashboard.warehouse-router.ts

import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ItemService } from "../physical-warehouse/physical-warehouse-service.ts";

const tags = ["Dashboard", "Warehouse"];

export function createDashboardWarehouseRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardWarehouseRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.auditLog);

    app.get(
        "/warehouse/locations",
        async ({ profile }) => {
            // Kiểm tra quyền truy cập kho hoặc quyền admin dashboard
            const requiredPermission = 
                (Permission as any).DASHBOARD_WAREHOUSE ?? 
                Permission.PHYSICAL_WAREHOUSE_ITEM_READ ?? 
                Permission.DASHBOARD_ADMIN;

            authHelper.checkPermission(profile, requiredPermission);

            // 1. Lấy danh sách các kho gốc (parentId = null) bằng phương thức có sẵn
            const { items: roots } = await ItemService.list({ parentId: null });

            // 2. Duyệt qua từng kho và lấy thông số sức chứa thực tế từ ItemService.stats
            const resolvedRoots = await Promise.all(
                roots.map(async (root) => {
                    try {
                        const { stats } = await ItemService.stats(root.id);
                        return {
                            ...root,
                            capacity: stats.totalCapacity,
                            usedCapacity: stats.usedCapacity,
                            childCount: stats.bottomLevelCount, // Số lượng ô chứa thực tế dưới kho này
                        };
                    } catch (error) {
                        // Fallback giá trị mặc định nếu xảy ra lỗi đọc dữ liệu stats của kho cụ thể
                        return {
                            ...root,
                            capacity: 0,
                            usedCapacity: 0,
                            childCount: 0,
                        };
                    }
                })
            );

            return resolvedRoots;
        },
        {
            detail: {
                tags,
                summary: "Danh sách kho kèm sức chứa tổng hợp",
                description: "Sử dụng kết hợp API list và stats có sẵn của ItemService để trả về số liệu tổng thể.",
            },
        }
    );

    return app;
}