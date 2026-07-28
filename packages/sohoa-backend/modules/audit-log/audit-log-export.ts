import ExcelJS from "exceljs";
import type { ApiAuditLog } from "../../db/schemas/api-audit-log.ts";

export function serializeAuditLogsToJson(records: ApiAuditLog[]): Uint8Array {
    const payload = JSON.stringify(records, null, 2);
    return new TextEncoder().encode(payload);
}

export async function buildAuditLogsExcel(records: ApiAuditLog[]): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Audit Logs");

    sheet.columns = [
        { header: "Thời gian", key: "createdAt", width: 22 },
        { header: "Người dùng", key: "userId", width: 38 },
        { header: "Module", key: "module", width: 18 },
        { header: "Thao tác", key: "eventType", width: 16 },
        { header: "Mô tả", key: "summary", width: 40 },
        { header: "Entity", key: "entityId", width: 24 },
        { header: "IP", key: "ip", width: 16 },
        { header: "Method", key: "method", width: 10 },
        { header: "Path", key: "path", width: 36 },
        { header: "Status", key: "statusCode", width: 10 },
    ];

    for (const record of records) {
        sheet.addRow({
            createdAt: record.createdAt?.toISOString() ?? "",
            userId: record.userId ?? "",
            module: record.module ?? "",
            eventType: record.eventType ?? "",
            summary: record.summary ?? "",
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
