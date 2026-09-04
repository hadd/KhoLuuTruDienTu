import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { DASHBOARD_ADMIN_SUB_PERMISSIONS, Permission } from "../auth/permission-catalog.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { DashboardService as service } from "./dashboard-service.ts";
import { adminDashboardQuerySchema, adminDashboardResponseSchema } from "./types.ts";

const tags = ["Admin", "Dashboard"];

export function createDashboardAdminRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.auditLog);

    app.get(
        "/",
        async ({ profile, query }) => {
            authHelper.checkPermissionAny(profile, [Permission.DASHBOARD_ADMIN, ...DASHBOARD_ADMIN_SUB_PERMISSIONS]);
            const hasReadAll = authHelper.hasPermission(profile, Permission.DASHBOARD_ADMIN_READ_ALL);
            const scope = hasReadAll ? { type: "global" as const } : await projectAccessHelper.resolveScope(profile);
            const includeUnassigned = authHelper.hasPermission(profile, Permission.DASHBOARD_ADMIN_UNASSIGNED);
            return await service.getAdminDashboard(query.chartGranularity ?? "month", {
                projectCodes: scope.type === "managed" ? scope.projectCodes : undefined,
                includeUnassigned,
            });
        },
        {
            query: adminDashboardQuerySchema,
            response: adminDashboardResponseSchema,
            detail: {
                tags,
                summary: "Admin dashboard statistics",
                description:
                    "Returns system-wide dossier and project summaries, dossier bar-chart data (edited vs completed over time), performance metrics, and per-group summaries. Use chartGranularity=day|month|year for the timeline chart.",
            },
        },
    );

    return app;
}
