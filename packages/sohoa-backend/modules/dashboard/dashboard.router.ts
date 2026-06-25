import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { DashboardService as service } from "./dashboard-service.ts";
import {
    editorDashboardResponseSchema,
    qcDashboardResponseSchema,
    qcGroupDashboardResponseSchema,
} from "./types.ts";

const tags = ["Dashboard"];

export function createDashboardRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/editor",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DASHBOARD_EDITOR);
            return await service.getEditorStats(profile.id);
        },
        {
            response: editorDashboardResponseSchema,
            detail: {
                tags,
                summary: "Editor dashboard statistics",
                description:
                    "Returns assigned dossier counts, completion status, accuracy on approved dossiers, and average processing time for the current editor.",
            },
        },
    );

    app.get(
        "/qc",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DASHBOARD_QC);
            return await service.getQcStats(profile.id);
        },
        {
            response: qcDashboardResponseSchema,
            detail: {
                tags,
                summary: "QC dashboard statistics",
                description:
                    "Returns assigned dossier review counts, approve/reject metrics, efficiency rates, and per-step breakdown for the current QC user.",
            },
        },
    );

    app.get(
        "/qc/group",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DASHBOARD_QC);
            return await service.getQcGroupStats(profile.id);
        },
        {
            response: qcGroupDashboardResponseSchema,
            detail: {
                tags,
                summary: "QC group dashboard statistics (leader only)",
                description:
                    "Returns group-level progress, editor performance, and QC member approval rates. Only accessible to the active leader of a group.",
            },
        },
    );

    return app;
}
