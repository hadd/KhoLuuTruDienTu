import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { DashboardService as service } from "./dashboard-service.ts";
import { adminDashboardResponseSchema } from "./types.ts";

const tags = ["Admin", "Dashboard"];

export function createDashboardAdminRouter(basePath: string = "/dashboard") {
    const app = new Elysia({
        name: "dashboardAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkAdmin(profile);
            return await service.getAdminDashboard();
        },
        {
            response: adminDashboardResponseSchema,
            detail: {
                tags,
                summary: "Admin dashboard statistics",
                description:
                    "Returns system-wide dossier and project summaries, performance metrics, per-group summaries, and recent workflow activity.",
            },
        },
    );

    return app;
}
