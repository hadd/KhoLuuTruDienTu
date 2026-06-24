import { ISSUE_REPORT_STATUS_VALUES } from "./issue-report-constants.ts";
import { schema } from "./schema-helper.ts";

export const issueReportStatusEnum = schema.enum(
    "issue_report_status",
    ISSUE_REPORT_STATUS_VALUES,
);
