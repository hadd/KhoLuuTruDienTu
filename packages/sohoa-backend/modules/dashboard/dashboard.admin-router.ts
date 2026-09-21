import { Elysia } from "elysia";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { DASHBOARD_ADMIN_SUB_PERMISSIONS, Permission } from "../auth/permission-catalog.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { DashboardService as service } from "./dashboard-service.ts";
import {
    adminDashboardResponseSchema,
    adminDossierChartQuerySchema,
    adminDossierChartResponseSchema,
    adminEmployeeKpisQuerySchema,
    adminEmployeeKpisResponseSchema,
} from "./types.ts";

const tags = ["Admin", "Dashboard"];

async function resolveAdminDashboardScope(profile: UserWithRoles) {
    authHelper.checkPermissionAny(profile, [Permission.DASHBOARD_ADMIN, ...DASHBOARD_ADMIN_SUB_PERMISSIONS]);
    const hasReadAll = authHelper.hasPermission(profile, Permission.DASHBOARD_ADMIN_READ_ALL);
    const scope = hasReadAll ? { type: "global" as const } : await projectAccessHelper.resolveScope(profile);
    const includeUnassigned = authHelper.hasPermission(profile, Permission.DASHBOARD_ADMIN_UNASSIGNED);
    return {
        projectCodes: scope.type === "managed" ? scope.projectCodes : undefined,
        includeUnassigned,
    };
}

export function createDashboardAdminRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.auditLog);

    app.get(
        "/",
        async ({ profile }) => {
            const scope = await resolveAdminDashboardScope(profile);
            return await service.getAdminDashboard(scope);
        },
        {
            response: adminDashboardResponseSchema,
            detail: {
                tags,
                summary: "Admin dashboard statistics",
                description:
                    "Returns system-wide dossier/project summaries, workload volume stats (dossiers/files/pages), performance metrics, and per-group summaries.",
            },
        },
    );

    app.get(
        "/employee-kpis",
        async ({ profile, query }) => {
            const scope = await resolveAdminDashboardScope(profile);
            return await service.getAdminEmployeeKpis({
                ...scope,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
            });
        },
        {
            query: adminEmployeeKpisQuerySchema,
            response: adminEmployeeKpisResponseSchema,
            detail: {
                tags,
                summary: "Admin employee KPI statistics",
                description: "Returns per-employee KPI rows filtered by assignment date range.",
            },
        },
    );

    app.get(
        "/dossier-chart",
        async ({ profile, query }) => {
            const scope = await resolveAdminDashboardScope(profile);
            return await service.getAdminDossierChart(query.chartGranularity ?? "month", {
                ...scope,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
            });
        },
        {
            query: adminDossierChartQuerySchema,
            response: adminDossierChartResponseSchema,
            detail: {
                tags,
                summary: "Admin dossier completion trend chart",
                description:
                    "Returns dossier completion timeline points. Use chartGranularity=day|month|quarter|year and optional dateFrom/dateTo.",
            },
        },
    );

    return app;
}
