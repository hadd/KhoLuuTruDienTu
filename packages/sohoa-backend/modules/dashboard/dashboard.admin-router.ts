import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
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
            authHelper.checkPermission(profile, Permission.DASHBOARD_ADMIN);
            const scope = await projectAccessHelper.resolveScope(profile);
            return await service.getAdminDashboard(query.chartGranularity ?? "month", {
                projectCodes: scope.type === "managed" ? scope.projectCodes : undefined,
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
