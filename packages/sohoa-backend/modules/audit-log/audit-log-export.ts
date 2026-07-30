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
    if (!user) return record.userId ?? "";
    return user.fullName?.trim() || user.email || user.id;
}

function formatEntityLabel(record: AuditLogExportRecord): string {
    return record.entity?.label
        ?? record.entityLabel
        ?? record.entityId
        ?? "";
}

export function serializeAuditLogsToJson(records: AuditLogExportRecord[]): Uint8Array {
    const payload = JSON.stringify(records, null, 2);
    return new TextEncoder().encode(payload);
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
            createdAt: record.createdAt?.toISOString() ?? "",
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
