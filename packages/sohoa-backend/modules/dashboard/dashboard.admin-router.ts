import { Elysia } from "elysia";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import {
    DASHBOARD_ADMIN_SUB_PERMISSIONS,
    DASHBOARD_OVERVIEW_SECTION_PERMISSIONS,
    DASHBOARD_TEAM_SECTION_PERMISSIONS,
    Permission,
} from "../auth/permission-catalog.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { DashboardService as service } from "./dashboard-service.ts";
import {
    adminDashboardQuerySchema,
    adminDossierChartQuerySchema,
    adminDossierChartResponseSchema,
    adminEmployeeKpisQuerySchema,
    adminEmployeeKpisResponseSchema,
    adminDashboardResponseSchema,
} from "./types.ts";

const tags = ["Admin", "Dashboard"];

const ADMIN_DASHBOARD_PERMISSIONS = [
    Permission.DASHBOARD_ADMIN,
    Permission.DASHBOARD_OVERVIEW,
    Permission.DASHBOARD_TEAM,
    ...DASHBOARD_ADMIN_SUB_PERMISSIONS,
    ...DASHBOARD_OVERVIEW_SECTION_PERMISSIONS,
    ...DASHBOARD_TEAM_SECTION_PERMISSIONS,
] as const;

async function resolveAdminDashboardScope(profile: UserWithRoles) {
    authHelper.checkPermissionAny(profile, [...ADMIN_DASHBOARD_PERMISSIONS]);
    const hasReadAll = authHelper.hasPermission(profile, Permission.DASHBOARD_ADMIN_READ_ALL);
    const scope = hasReadAll ? { type: "global" as const } : await projectAccessHelper.resolveScope(profile);
    const includeUnassigned = authHelper.hasPermission(profile, Permission.DASHBOARD_ADMIN_UNASSIGNED);
    return {
        projectCodes: scope.type === "managed" ? scope.projectCodes : undefined,
        includeUnassigned,
    };
}

/**
 * Resolves the effective scope (projectCodes and includeUnassigned) for a dashboard query
 * based on user's permission scope and the selected UI project filter (`query.projectCode`).
 *
 * Rules:
 * 1. `selectedProjectCode` is undefined ("Tất cả dự án"):
 *    - Returns user's scope as-is (projectCodes and includeUnassigned).
 * 2. `selectedProjectCode` === "__unassigned__" ("Chưa gắn dự án"):
 *    - projectCodes = []
 *    - includeUnassigned = scope.includeUnassigned (if user has permission to view unassigned, else false)
 * 3. `selectedProjectCode` is a specific project code (e.g. "DK_0100" or "SD_RV"):
 *    - includeUnassigned = false (CRITICAL: unassigned dossiers MUST NOT be included when filtering a specific project)
 *    - projectCodes = [selectedProjectCode] (if allowed in user scope) or [] (if forbidden)
 */
function resolveEffectiveScope(
    scope: { projectCodes?: string[]; includeUnassigned: boolean },
    selectedProjectCode: string | undefined,
): { projectCodes?: string[]; includeUnassigned: boolean } {
    if (!selectedProjectCode) {
        return scope;
    }

    if (selectedProjectCode === "__unassigned__") {
        return {
            projectCodes: [],
            includeUnassigned: scope.includeUnassigned,
        };
    }

    // Specific project selected -> NEVER include unassigned dossiers
    if (scope.projectCodes === undefined) {
        // User has global access
        return {
            projectCodes: [selectedProjectCode],
            includeUnassigned: false,
        };
    }

    // User has managed/scoped access
    if (scope.projectCodes.includes(selectedProjectCode)) {
        return {
            projectCodes: [selectedProjectCode],
            includeUnassigned: false,
        };
    }

    return {
        projectCodes: [],
        includeUnassigned: false,
    };
}


export function createDashboardAdminRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.auditLog);

    app.get(
        "/",
        async ({ profile, query }) => {
            const scope = await resolveAdminDashboardScope(profile);
            const effective = resolveEffectiveScope(scope, query.projectCode);
            return await service.getAdminDashboard({
                projectCodes: effective.projectCodes,
                includeUnassigned: effective.includeUnassigned,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
            });
        },
        {
            query: adminDashboardQuerySchema,
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
            const effective = resolveEffectiveScope(scope, query.projectCode);
            return await service.getAdminEmployeeKpis({
                projectCodes: effective.projectCodes,
                includeUnassigned: effective.includeUnassigned,
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
            const effective = resolveEffectiveScope(scope, query.projectCode);
            return await service.getAdminDossierChart(query.chartGranularity ?? "month", {
                projectCodes: effective.projectCodes,
                includeUnassigned: effective.includeUnassigned,
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
