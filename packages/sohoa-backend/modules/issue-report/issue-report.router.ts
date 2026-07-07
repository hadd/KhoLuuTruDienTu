import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { IssueReportService } from "./issue-report-service.ts";
import {
    issueReportRejectBodySchema,
    issueReportResponseSchema,
} from "./types.ts";

const tags = ["Data Entry", "Issue Report"];

export function createIssueReportRouter(basePath: string = "/issue-reports") {
    const app = new Elysia({
        name: "issueReportRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/dossier/:dossierId",
        async ({ profile, params }) => {
            authHelper.checkDossierWorkflowDataAccess(profile);
            return await IssueReportService.listOpenForDossier(params.dossierId);
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            response: t.Array(issueReportResponseSchema),
            detail: {
                tags,
                summary: "Lấy danh sách thông báo vấn đề đang mở của hồ sơ",
                description:
                    "Trả về tất cả thông báo PENDING/CONFIRMED/ESCALATED — mỗi biên tập viên có thể gửi riêng.",
            },
        },
    );

    app.post(
        "/:reportId/confirm",
        async ({ profile, params }) => {
            await authHelper.checkPermission(profile, Permission.DATA_ENTRY_CHECKER);
            return await IssueReportService.confirm(params.reportId, profile.id);
        },
        {
            params: t.Object({ reportId: IdParam("Issue report ID") }),
            response: issueReportResponseSchema,
            detail: {
                tags,
                summary: "Checker xác nhận thông báo vấn đề",
                description:
                    "Xác nhận vấn đề tài liệu hợp lệ. Sau khi xác nhận, checker có thể duyệt bình thường; nếu checker sửa metadata thì biên tập không bị tính sai.",
            },
        },
    );

    app.post(
        "/:reportId/reject",
        async ({ profile, params, body }) => {
            await authHelper.checkPermission(profile, Permission.DATA_ENTRY_CHECKER);
            return await IssueReportService.reject(
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
                summary: "Checker từ chối thông báo vấn đề",
                description:
                    "Từ chối thông báo của một biên tập viên và chỉ mở lại phân công của người đó. Các maker/issue khác trên cùng hồ sơ không bị ảnh hưởng.",
            },
        },
    );

    app.post(
        "/:reportId/escalate",
        async ({ profile, params }) => {
            await authHelper.checkPermission(profile, Permission.DATA_ENTRY_CHECKER);
            return await IssueReportService.escalate(params.reportId, profile.id);
        },
        {
            params: t.Object({ reportId: IdParam("Issue report ID") }),
            response: issueReportResponseSchema,
            detail: {
                tags,
                summary: "Checker chuyển tiếp thông báo tới quản lý dự án",
                description:
                    "Chuyển tiếp cho quản lý dự án (projects.manager_id). Hồ sơ chuyển WAITING_ISSUE_RESOLUTION; checker bị chặn duyệt cho đến khi PM đóng vấn đề.",
            },
        },
    );

    return app;
}
