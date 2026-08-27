import ExcelJS from "exceljs";
import type { ApiAuditLog } from "../../db/schemas/api-audit-log.ts";
import type { AuditLogEntityInfo } from "./audit-entity-resolver.ts";

export type AuditLogExportRecord = ApiAuditLog & {
    user?: {
        id: string;
        email: string;
        fullName: string | null;
    } | null;
    entity?: AuditLogEntityInfo | null;
};

function formatUserLabel(
    record: AuditLogExportRecord,
): string {
    const user = record.user;
    if (user) {
        return user.fullName?.trim() || user.email || user.id;
    }
    if (!record.userId) {
        const eventType = (record.eventType ?? "").toLowerCase();
        const summary = (record.summary ?? "").toLowerCase();
        if (
            eventType === "expire_borrow" ||
            eventType === "auto_reject_borrow" ||
            eventType.startsWith("auto_") ||
            eventType.startsWith("cron_") ||
            eventType.startsWith("purge_") ||
            eventType.startsWith("system_") ||
            summary.includes("hết hạn phiếu mượn") ||
            summary.includes("tự động từ chối") ||
            summary.includes("tự động dọn dẹp") ||
            summary.includes("tự động đồng bộ") ||
            summary.includes("tự động ocr") ||
            summary.includes("hệ thống tự động") ||
            summary.includes("auto-rejected") ||
            summary.includes("auto-expired")
        ) {
            return "Hệ thống";
        }
    }
    return record.userId ?? "Không xác định";
}

function formatEntityLabel(record: AuditLogExportRecord): string {
    const label = record.entity?.label ?? record.entityLabel;
    if (!label || label === record.entityId) return "";
    return label;
}

export function serializeAuditLogsToJson(records: AuditLogExportRecord[]): Uint8Array {
    const payload = JSON.stringify(records, null, 2);
    return new TextEncoder().encode(payload);
}

function formatIsoDate(value: Date | string | null | undefined): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    try {
        return new Date(value).toISOString();
    } catch {
        return String(value);
    }
}

export async function buildAuditLogsExcel(records: AuditLogExportRecord[]): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Audit Logs");

    sheet.columns = [
        { header: "Thời gian", key: "createdAt", width: 22 },
        { header: "Người dùng", key: "userLabel", width: 28 },
        { header: "Module", key: "module", width: 18 },
        { header: "Thao tác", key: "eventType", width: 16 },
        { header: "Mô tả", key: "summary", width: 40 },
        { header: "Loại đối tượng", key: "entityType", width: 20 },
        { header: "Đối tượng", key: "entityLabel", width: 32 },
        { header: "Entity ID", key: "entityId", width: 24 },
        { header: "IP", key: "ip", width: 16 },
        { header: "Method", key: "method", width: 10 },
        { header: "Path", key: "path", width: 36 },
        { header: "Status", key: "statusCode", width: 10 },
    ];

    for (const record of records) {
        sheet.addRow({
            createdAt: formatIsoDate(record.createdAt),
            userLabel: formatUserLabel(record),
            module: record.module ?? "",
            eventType: record.eventType ?? "",
            summary: record.summary ?? "",
            entityType: record.entityType ?? "",
            entityLabel: formatEntityLabel(record),
            entityId: record.entityId ?? "",
            ip: record.ip ?? "",
            method: record.method,
            path: record.path,
            statusCode: record.statusCode,
        });
    }

    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
}
