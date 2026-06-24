import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { IssueReportStatus } from "../../db/schemas/issue-report-constants.ts";
import { IssueReportService } from "./issue-report-service.ts";
import {
    issueReportListQuerySchema,
    issueReportRejectBodySchema,
    issueReportResponseSchema,
} from "./types.ts";

const tags = ["Admin", "Issue Report"];

export function createIssueReportAdminRouter(basePath: string = "/issue-reports") {
    const app = new Elysia({
        name: "issueReportAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery);

    app.get(
        "/",
        async ({ profile, urlQuery }) => {
            authHelper.checkAdminOrProjectManager(profile);
            const scope = await projectAccessHelper.resolveScope(profile);
            const status = urlQuery.status as IssueReportStatus | undefined;

            return await IssueReportService.listForProjectManager({
                managerId: profile.id,
                status,
                projectCodes: scope.type === "managed" ? scope.projectCodes : undefined,
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
            });
        },
        {
            detail: {
                tags,
                summary: "Quản lý dự án xem thông báo vấn đề được chuyển tiếp",
                description:
                    "Danh sách thông báo ESCALATED (và lịch sử) gửi tới quản lý dự án đang đăng nhập.",
            },
        },
    );

    app.post(
        "/:reportId/confirm",
        async ({ profile, params }) => {
            authHelper.checkAdminOrProjectManager(profile);
            return await IssueReportService.confirmByProjectManager(
                params.reportId,
                profile.id,
            );
        },
        {
            params: t.Object({ reportId: IdParam("Issue report ID") }),
            response: issueReportResponseSchema,
            detail: {
                tags,
                summary: "Quản lý dự án xác nhận thông báo đã chuyển tiếp",
            },
        },
    );

    app.post(
        "/:reportId/reject",
        async ({ profile, params, body }) => {
            authHelper.checkAdminOrProjectManager(profile);
            return await IssueReportService.rejectByProjectManager(
                params.reportId,
                profile.id,
                body.notes,
                body.reject_fields,
            );
        },
        {
            params: t.Object({ reportId: IdParam("Issue report ID") }),
            body: issueReportRejectBodySchema,
            detail: {
                tags,
                summary: "Quản lý dự án từ chối thông báo và reject hồ sơ",
            },
        },
    );

    return app;
}
