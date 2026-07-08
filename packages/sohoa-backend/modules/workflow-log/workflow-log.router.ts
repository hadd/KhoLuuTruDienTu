import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { listWorkflowLogs } from "./workflow-log-service.ts";

const tags = ["Workflow Log"];

export function createWorkflowLogRouter() {
    const app = new Elysia({ name: "workflowLogRouter" })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/dossiers/:id/workflow-logs",
        async ({ params, profile }) => {
            authHelper.checkDossierWorkflowDataAccess(profile);
            return await listWorkflowLogs(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Danh sách lịch sử workflow",
                description: "Trả về danh sách các bước chuyển trạng thái và hành động workflow của hồ sơ, sắp xếp theo thời gian mới nhất trước.",
            },
        },
    );

    return app;
}
