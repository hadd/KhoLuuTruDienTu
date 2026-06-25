import { t } from "elysia";

/** Trạng thái thông báo vấn đề tài liệu từ biên tập gửi tới người duyệt kế tiếp. */
export const IssueReportStatus = {
    /** Chờ checker xử lý — chặn approve/reject thông thường. */
    PENDING: "PENDING",
    /** Checker xác nhận vấn đề hợp lệ — miễn trừ tính sai cho biên tập khi checker sửa. */
    CONFIRMED: "CONFIRMED",
    /** Từ chối thông báo — đã chạy luồng reject bình thường. */
    REJECTED: "REJECTED",
    /** Chuyển tiếp quản lý dự án — chặn checker cho đến khi PM đóng (hoặc gửi thẳng khi không có cấp duyệt). */
    ESCALATED: "ESCALATED",
    /** Đã đóng (checker duyệt xong sau confirm, hoặc PM đóng sau khi xử lý chuyển tiếp). */
    CLOSED: "CLOSED",
} as const;

export type IssueReportStatus = (typeof IssueReportStatus)[keyof typeof IssueReportStatus];

export const ISSUE_REPORT_STATUS_VALUES = Object.values(IssueReportStatus) as [
    IssueReportStatus,
    IssueReportStatus,
    IssueReportStatus,
    IssueReportStatus,
    IssueReportStatus,
];

export const issueReportStatusSchema = t.Enum(IssueReportStatus);

/** Trạng thái đang chặn checker khỏi approve/reject thông thường. */
export const BLOCKING_ISSUE_REPORT_STATUSES = [
    IssueReportStatus.PENDING,
    IssueReportStatus.ESCALATED,
] as const;
