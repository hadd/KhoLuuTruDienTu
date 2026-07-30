import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import { IssueReportStatus } from "../../db/schemas/issue-report-constants.ts";
import { IssueReportService } from "./issue-report-service.ts";
import {
  issueReportCloseBodySchema,
  issueReportResponseSchema,
} from "./types.ts";

const tags = ["Admin", "Issue Report"];

export function createIssueReportAdminRouter(
  basePath: string = "/issue-reports",
) {
  const app = new Elysia({
    name: "issueReportAdminRouter",
    prefix: basePath,
  })
    .use(plugins.authProfile)
    .use(plugins.auditLog)
    .use(plugins.urlQuery);

  app.get(
    "/",
    async ({ profile, urlQuery }) => {
      authHelper.checkAdminOrProjectManager(profile);
      const scope = await projectAccessHelper.resolveScope(profile);
      const status = urlQuery.status as IssueReportStatus | undefined;

      return await IssueReportService.listForProjectManager({
        managerId: profile.id,
        scopeType: scope.type,
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
          "Admin: mọi thông báo ESCALATED/CLOSED. Quản lý dự án: chỉ thông báo chuyển tới mình.",
      },
    },
  );

  app.post(
    "/:reportId/close",
    async ({ profile, params, body }) => {
      authHelper.checkAdminOrProjectManager(profile);
      return await IssueReportService.closeByProjectManager(
        params.reportId,
        profile.id,
        body.notes,
        { isSystemAdmin: projectAccessHelper.isSystemAdmin(profile) },
      );
    },
    {
      params: t.Object({ reportId: IdParam("Issue report ID") }),
      body: issueReportCloseBodySchema,
      response: issueReportResponseSchema,
      detail: {
        tags,
        summary: "Quản lý dự án đóng vấn đề sau khi đã xử lý",
        description:
          "Đánh dấu thông báo đã xử lý xong. Khi không còn issue ESCALATED khác, hồ sơ WAITING_ISSUE_RESOLUTION chuyển sang ERROR (không resume workflow). Admin có thể đóng mọi issue đã escalate.",
      },
    },
  );

  return app;
}
