import { assertEquals } from "@std/assert";
import { IssueReportStatus } from "../db/schemas/issue-report-constants.ts";
import { BLOCKING_ISSUE_REPORT_STATUSES } from "../db/schemas/issue-report-constants.ts";

Deno.test("BLOCKING_ISSUE_REPORT_STATUSES — chỉ PENDING và ESCALATED chặn checker", () => {
    const blocking = BLOCKING_ISSUE_REPORT_STATUSES as readonly string[];
    assertEquals(blocking.includes(IssueReportStatus.PENDING), true);
    assertEquals(blocking.includes(IssueReportStatus.ESCALATED), true);
    assertEquals(blocking.includes(IssueReportStatus.CONFIRMED), false);
    assertEquals(blocking.includes(IssueReportStatus.REJECTED), false);
    assertEquals(blocking.includes(IssueReportStatus.CLOSED), false);
});
