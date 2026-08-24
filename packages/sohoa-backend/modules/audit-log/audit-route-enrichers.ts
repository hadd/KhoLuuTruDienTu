import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    formatDossierLabel,
} from "./warehouse-audit.ts";
import type { AuditRouteEnrichContext, AuditRouteEnrichResult } from "./audit-route-types.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadDossierLabel(dossierId: string): Promise<string> {
    if (!dossierId || !UUID_RE.test(dossierId)) return dossierId;
    try {
        const [row] = await db
            .select({
                id: dossiers.id,
                name: dossiers.name,
                folderPath: dossiers.folderPath,
            })
            .from(dossiers)
            .where(activeDossierWhere(eq(dossiers.id, dossierId)))
            .limit(1);
        if (!row) return dossierId;
        return formatDossierLabel(row);
    } catch {
        return dossierId;
    }
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

export async function enrichArchiveMoveFile(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const response = asRecord(ctx.response);
    if (!response) return null;

    const sourceId = String(response.sourceDossierId ?? ctx.params.dossierId ?? "");
    const targetId = String(response.targetDossierId ?? "");
    const fileId = String(response.fileId ?? ctx.params.fileId ?? "");
    const fileName = String(response.destFileName ?? "");

    const [sourceName, targetName] = await Promise.all([
        sourceId ? loadDossierLabel(sourceId) : Promise.resolve(""),
        targetId ? loadDossierLabel(targetId) : Promise.resolve(""),
    ]);

    const movedFiles = response.movedFiles;
    if (Array.isArray(movedFiles) && movedFiles.length > 1) {
        return {
            summary: `Chuyển ${movedFiles.length} file từ hồ sơ "${sourceName}" sang "${targetName}"`,
            entityType: "dossier",
            entityId: sourceId || null,
            details: {
                movedCount: movedFiles.length,
                sourceDossierId: sourceId,
                sourceDossierName: sourceName,
                targetDossierId: targetId,
                targetDossierName: targetName,
                files: movedFiles,
            },
        };
    }

    return {
        summary: `Chuyển file "${fileName}" từ hồ sơ "${sourceName}" sang "${targetName}"`,
        entityType: "dossier_file",
        entityId: fileId || null,
        details: {
            fileId,
            fileName,
            renamed: response.renamed ?? false,
            sourceDossierId: sourceId,
            sourceDossierName: sourceName,
            targetDossierId: targetId,
            targetDossierName: targetName,
        },
    };
}

export async function enrichArchiveDeleteFile(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const response = asRecord(ctx.response);
    if (!response) return null;

    const dossierId = String(response.dossierId ?? ctx.params.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
    const deletedCount = Number(response.deletedCount ?? 1);
    const deletedFileId = response.deletedFileId ?? response.deletedFileIds;

    if (deletedCount > 1) {
        return {
            summary: `Xóa ${deletedCount} file trong hồ sơ "${dossierName}"`,
            entityType: "dossier",
            entityId: dossierId || null,
            details: {
                dossierId,
                dossierName,
                deletedCount,
                deletedFileIds: response.deletedFileIds,
            },
        };
    }

    return {
        summary: `Xóa file trong hồ sơ "${dossierName}"`,
        entityType: "dossier_file",
        entityId: deletedFileId ? String(deletedFileId) : null,
        details: {
            dossierId,
            dossierName,
            deletedFileId,
        },
    };
}

export async function enrichArchiveUpdateFileDocumentType(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const response = asRecord(ctx.response);
    const file = asRecord(response?.file);
    if (!file) return null;

    const dossierId = String(file.dossierId ?? ctx.params.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
    const fileName = String(file.id ?? ctx.params.fileId ?? "");

    return {
        summary: `Cập nhật loại tài liệu file trong hồ sơ "${dossierName}"`,
        entityType: "dossier_file",
        entityId: String(file.id ?? ctx.params.fileId ?? ""),
        details: {
            dossierId,
            dossierName,
            fileId: file.id,
            documentTypeId: file.documentTypeId,
            documentTypeName: file.documentTypeName,
            securityLevelId: file.securityLevelId,
        },
    };
}

export async function enrichPhysicalPlacementPlace(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const response = asRecord(ctx.response);
    const placement = asRecord(response?.placement);
    const dossierId = String(body?.dossierId ?? placement?.dossierId ?? "");
    const breadcrumb = response?.breadcrumb ? String(response.breadcrumb) : null;
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";

    return {
        summary: `Gắn hồ sơ "${dossierName}" vào kho vật lý${breadcrumb ? `: ${breadcrumb}` : ""}`,
        entityType: "dossier",
        entityId: dossierId || null,
        details: {
            dossierId,
            dossierName,
            physicalItemId: body?.physicalItemId ?? placement?.physicalItemId,
            location: breadcrumb,
        },
    };
}

export async function enrichPhysicalPlacementMove(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const response = asRecord(ctx.response);
    const placement = asRecord(response?.placement);
    const dossierId = String(body?.dossierId ?? placement?.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
    const toLocation = response?.breadcrumb ? String(response.breadcrumb) : null;
    const fromLocation = response?.fromBreadcrumb ? String(response.fromBreadcrumb) : null;

    return {
        summary: `Đổi vị trí kho vật lý hồ sơ "${dossierName}"${toLocation ? `: ${fromLocation ?? "?"} → ${toLocation}` : ""}`,
        entityType: "dossier",
        entityId: dossierId || null,
        details: {
            dossierId,
            dossierName,
            toPhysicalItemId: body?.physicalItemId ?? body?.newPhysicalItemId ?? placement?.physicalItemId,
            fromLocation,
            toLocation,
        },
    };
}

export async function enrichPhysicalPlacementRemove(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const response = asRecord(ctx.response);
    const placement = asRecord(response?.placement);
    const dossierId = String(body?.dossierId ?? placement?.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";

    const fromBreadcrumb = response?.fromBreadcrumb ? String(response.fromBreadcrumb) : null;

    return {
        summary: `Gỡ hồ sơ "${dossierName}" khỏi kho vật lý${fromBreadcrumb ? `: ${fromBreadcrumb}` : ""}`,
        entityType: "dossier",
        entityId: dossierId || null,
        details: {
            dossierId,
            dossierName,
            location: fromBreadcrumb,
        },
    };
}

export function enrichInventoryCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Tạo mục lục"
        : operation === "update"
        ? "Cập nhật mục lục"
        : "Xóa mục lục";

    return (ctx) => {
        const response = asRecord(ctx.response);
        const body = asRecord(ctx.body);
        const record = asRecord(response?.record) ?? body;
        if (!record && !ctx.params.id) return null;

        const name = String(record?.name ?? "");
        const number = String(record?.number ?? "");
        const id = String(record?.id ?? ctx.params.id ?? "");
        const label = name
            ? (number ? `"${name}" (${number})` : `"${name}"`)
            : id;

        return {
            summary: `${prefix} ${label}`,
            entityType: "inventory",
            entityId: id || null,
            details: {
                id: record?.id ?? id,
                name: record?.name,
                number: record?.number,
                fondId: record?.fondId,
                submissionYear: record?.submissionYear,
            },
        };
    };
}

export function enrichPhysicalWarehouseItemCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Thêm mục kho"
        : operation === "update"
        ? "Cập nhật mục kho"
        : "Xóa mục kho";

    return (ctx) => {
        const response = asRecord(ctx.response);
        const body = asRecord(ctx.body);
        const record = asRecord(response?.record) ?? body;
        if (!record && !ctx.params.id) return null;

        const name = String(record?.name ?? ctx.params.id ?? "");

        return {
            summary: `${prefix}: ${name}`,
            entityType: "physical_warehouse_item",
            entityId: String(record?.id ?? ctx.params.id ?? ""),
            details: {
                name: record?.name ?? null,
                parentId: record?.parentId ?? body?.parentId ?? null,
                capacity: record?.capacity ?? body?.capacity ?? null,
            },
        };
    };
}

export function enrichPhysicalWarehouseReparent(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const response = asRecord(ctx.response);
    const record = asRecord(response?.record);
    if (!record || !response) return null;

    return {
        summary: `Di chuyển ô chứa "${String(record.name ?? "")}" trong sơ đồ kho`,
        entityType: "physical_warehouse_item",
        entityId: String(record.id ?? ctx.params.id ?? ""),
        details: {
            name: record.name,
            fromParentId: response.fromParentId ?? null,
            toParentId: record.parentId,
        },
    };
}

export async function enrichDataEntryApprove(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const response = asRecord(ctx.response);
    const dossierId = String(
        response?.dossierId ?? ctx.params.dossierId ?? ctx.params.id ?? "",
    );
    if (!dossierId) return null;
    const dossierName = await loadDossierLabel(dossierId);
    const approvedQcStep = response?.approvedQcStep;

    return {
        summary: `Duyệt biên tập hồ sơ "${dossierName}"${approvedQcStep != null ? ` (bước QC ${approvedQcStep})` : ""}`,
        summaryKey: "audit.data_entry.approve",
        summaryParams: { dossierName, approvedQcStep },
        entityType: "dossier",
        entityId: dossierId,
        details: {
            dossierId,
            dossierName,
            dossierStatus: response?.dossierStatus ?? null,
            approvedQcStep: approvedQcStep ?? null,
        },
    };
}

export async function enrichDataEntryReject(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const response = asRecord(ctx.response);
    const body = asRecord(ctx.body);
    const dossierId = String(
        response?.dossierId ?? ctx.params.dossierId ?? ctx.params.id ?? "",
    );
    if (!dossierId) return null;
    const dossierName = await loadDossierLabel(dossierId);
    const rejectNotes = body?.notes ? String(body.notes) : null;
    const rejectFields = body?.reject_fields ?? response?.rejectFields ?? null;

    return {
        summary: `Từ chối biên tập hồ sơ "${dossierName}"`,
        summaryKey: "audit.data_entry.reject",
        summaryParams: { dossierName },
        entityType: "dossier",
        entityId: dossierId,
        details: {
            dossierId,
            dossierName,
            dossierStatus: response?.dossierStatus ?? null,
            rejectedQcStep: response?.rejectedQcStep ?? null,
            rejectNotes,
            rejectFields,
        },
    };
}

export async function enrichDataEntrySubmitMetadata(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const response = asRecord(ctx.response);
    const dossierId = String(ctx.params.id ?? response?.dossierId ?? "");
    if (!dossierId) return null;
    const dossierName = await loadDossierLabel(dossierId);
    const partial = response?.partial === true;

    return {
        summary: partial
            ? `Gửi biên tập một phần hồ sơ "${dossierName}"`
            : `Gửi biên tập hồ sơ "${dossierName}"`,
        summaryKey: partial ? "audit.data_entry.submit_partial" : "audit.data_entry.submit",
        summaryParams: { dossierName },
        entityType: "dossier",
        entityId: dossierId,
        details: {
            dossierId,
            dossierName,
            dossierStatus: response?.dossierStatus ?? null,
            partial,
        },
    };
}

export function enrichDataEntryBulkSubmit(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const response = asRecord(ctx.response);
    const submittedCount = Number(response?.submittedCount ?? 0);
    const failedCount = Number(response?.failedCount ?? 0);

    return {
        summary: `Gửi/duyệt hàng loạt ${submittedCount} hồ sơ nháp${failedCount > 0 ? ` (${failedCount} lỗi)` : ""}`,
        summaryKey: "audit.data_entry.bulk_submit",
        summaryParams: { submittedCount, failedCount },
        entityType: "dossier_assignment",
        entityId: null,
        details: {
            submittedCount,
            failedCount,
            submitted: response?.submitted ?? null,
            failed: response?.failed ?? null,
        },
    };
}

async function loadUserLabel(userId: string): Promise<string> {
    const [row] = await db
        .select({ id: userProfiles.id, email: userProfiles.email, fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1);
    if (!row) return userId;
    return row.email?.trim() || userId;
}

export async function enrichUserStatusUpdate(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const targetId = ctx.params.id;
    const targetLabel = await loadUserLabel(targetId);
    const active = Boolean(body?.active);

    return {
        summary: active
            ? `Kích hoạt tài khoản "${targetLabel}"`
            : `Vô hiệu hóa tài khoản "${targetLabel}"`,
        entityType: "user",
        entityId: targetId,
        details: { targetUserId: targetId, targetUserLabel: targetLabel, active },
    };
}

const ROLE_LABELS: Record<string, string> = {
    admin: "Quản trị viên",
    editor: "Biên tập viên",
    reviewer: "Phê duyệt viên",
    user: "Người dùng",
};

export function enrichRolePermissionsView(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const roleId = ctx.params.roleId ?? ctx.params.id;
    const roleLabel = ROLE_LABELS[roleId] ?? roleId;
    return {
        summary: `Xem danh sách quyền của vai trò "${roleLabel}"`,
        entityType: "role",
        entityId: roleId,
    };
}

export function enrichRecordCrud(
    entityType: string,
    labels: { create: string; update: string; delete: string },
    operation: "create" | "update" | "delete",
    nameField = "name",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = labels[operation];
    return (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(ctx.body);
        if (!record && !ctx.params.id) return null;
        const id = String(record?.id ?? ctx.params.id ?? "");
        const name = String(record?.[nameField] ?? record?.code ?? id);
        const label = name ? `"${name}"` : id;
        return {
            summary: `${prefix} ${label}`,
            entityType,
            entityId: id || null,
            details: {
                id: record?.id ?? id,
                name: record?.[nameField] ?? record?.name,
                code: record?.code,
            },
        };
    };
}

export const enrichFondCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("fond", {
        create: "Tạo phông",
        update: "Cập nhật phông",
        delete: "Xóa phông",
    }, op);

export const enrichRetentionPeriodCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("retention_period", {
        create: "Tạo thời hạn lưu trữ",
        update: "Cập nhật thời hạn lưu trữ",
        delete: "Xóa thời hạn lưu trữ",
    }, op);

export const enrichFolderCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("folder", {
        create: "Tạo thư mục",
        update: "Cập nhật thư mục",
        delete: "Xóa thư mục",
    }, op);

export const enrichDossierTypeCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("dossier_type", {
        create: "Tạo loại hồ sơ",
        update: "Cập nhật loại hồ sơ",
        delete: "Xóa loại hồ sơ",
    }, op);

export const enrichDocumentTypeCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("document_type", {
        create: "Tạo loại tài liệu",
        update: "Cập nhật loại tài liệu",
        delete: "Xóa loại tài liệu",
    }, op);

export const enrichGroupCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("group", {
        create: "Tạo nhóm",
        update: "Cập nhật nhóm",
        delete: "Xóa nhóm",
    }, op);

export const enrichProjectCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("project", {
        create: "Tạo dự án",
        update: "Cập nhật dự án",
        delete: "Xóa dự án",
    }, op, "code");

export const enrichSecurityLevelCrud = (op: "create" | "update" | "delete") =>
    enrichRecordCrud("security_level", {
        create: "Tạo cấp độ bảo mật",
        update: "Cập nhật cấp độ bảo mật",
        delete: "Xóa cấp độ bảo mật",
    }, op);

export function enrichMetadataTemplateCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Tạo mẫu metadata"
        : operation === "update"
        ? "Cập nhật mẫu metadata"
        : "Xóa mẫu metadata";
    return (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(ctx.body);
        const name = String(record?.name ?? ctx.params.id ?? "");
        return {
            summary: `${prefix}: "${name}"`,
            entityType: "metadata_template",
            entityId: String(record?.id ?? ctx.params.id ?? ""),
            details: { name: record?.name, code: record?.code },
        };
    };
}

export function enrichMetadataPermissionConfigCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Tạo cấu hình phân quyền metadata"
        : operation === "update"
        ? "Cập nhật cấu hình phân quyền metadata"
        : "Xóa cấu hình phân quyền metadata";
    return (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(ctx.body);
        const name = String(record?.name ?? ctx.params.id ?? "");
        return {
            summary: `${prefix}: "${name}"`,
            entityType: "metadata_permission_config",
            entityId: String(record?.id ?? ctx.params.id ?? ""),
            details: { name: record?.name },
        };
    };
}

export function enrichMetadataExportPresetCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Tạo preset xuất metadata"
        : operation === "update"
        ? "Cập nhật preset xuất metadata"
        : "Xóa preset xuất metadata";
    return (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(ctx.body);
        const name = String(record?.name ?? ctx.params.id ?? "");
        return {
            summary: `${prefix}: "${name}"`,
            entityType: "metadata_export_preset",
            entityId: String(record?.id ?? ctx.params.id ?? ""),
            details: { name: record?.name },
        };
    };
}

export function enrichDocumentNamingConfigCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Tạo quy tắc đặt tên"
        : operation === "update"
        ? "Cập nhật quy tắc đặt tên"
        : "Xóa quy tắc đặt tên";
    return (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(ctx.body);
        const name = String(record?.name ?? ctx.params.id ?? "");
        return {
            summary: `${prefix}: "${name}"`,
            entityType: "document_naming_config",
            entityId: String(record?.id ?? ctx.params.id ?? ""),
            details: { name: record?.name },
        };
    };
}

export function enrichRolePermissionsUpdate(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const roleId = ctx.params.id;
    const roleLabel = ROLE_LABELS[roleId] ?? roleId;
    return {
        summary: `Cập nhật quyền vai trò "${roleLabel}"`,
        entityType: "role",
        entityId: roleId,
        details: { roleId, permissions: asRecord(ctx.body)?.permissions ?? null },
    };
}

export async function enrichFolderAssignProject(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const folderId = ctx.params.id;
    const projectCode = String(body?.projectCode ?? "");
    return {
        summary: `Gán dự án "${projectCode}" cho thư mục`,
        entityType: "folder",
        entityId: folderId,
        details: { folderId, projectCode },
    };
}

export async function enrichScanIntakePromote(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const response = asRecord(ctx.response);
    const dossierId = String(body?.dossierId ?? response?.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
    return {
        summary: `Đẩy phiên scan lên hồ sơ "${dossierName}"`,
        entityType: "dossier",
        entityId: dossierId || null,
        details: {
            dossierId,
            dossierName,
            sessionId: body?.sessionId ?? response?.sessionId,
        },
    };
}

export function enrichScanIntakeSessionDelete(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const body = asRecord(ctx.body);
    return {
        summary: "Xóa phiên scan",
        entityType: "scan_session",
        entityId: body?.sessionId ? String(body.sessionId) : null,
        details: { sessionId: body?.sessionId },
    };
}

export async function enrichDigitalSignPrepare(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const dossierId = String(body?.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
    return {
        summary: `Chuẩn bị ký số hồ sơ "${dossierName}"`,
        entityType: "dossier",
        entityId: dossierId || null,
        details: { dossierId, dossierName },
    };
}

export async function enrichDigitalSignSubmit(
    ctx: AuditRouteEnrichContext,
): Promise<AuditRouteEnrichResult | null> {
    const body = asRecord(ctx.body);
    const fileId = String(body?.fileId ?? "");
    const dossierId = String(body?.dossierId ?? "");
    const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
    return {
        summary: `Gửi chữ ký số${dossierName ? ` cho hồ sơ "${dossierName}"` : ""}`,
        entityType: "dossier_file",
        entityId: fileId || null,
        details: { fileId, dossierId, dossierName },
    };
}

export function enrichDigitalSignVerify(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const fileId = ctx.params.fileId;
    return {
        summary: `Xác minh chữ ký số file`,
        entityType: "dossier_file",
        entityId: fileId,
        details: { fileId },
    };
}

export function enrichIssueReportAction(
    action: "confirm" | "reject" | "escalate",
): (ctx: AuditRouteEnrichContext) => Promise<AuditRouteEnrichResult | null> {
    const labels = {
        confirm: "Xác nhận thông báo vấn đề tài liệu",
        reject: "Từ chối thông báo vấn đề tài liệu",
        escalate: "Chuyển tiếp thông báo vấn đề tới quản lý dự án",
    };
    return async (ctx) => {
        const response = asRecord(ctx.response);
        const reportId = ctx.params.reportId ?? ctx.params.id ?? "";
        const dossierId = String(response?.dossierId ?? "");
        const dossierName = dossierId ? await loadDossierLabel(dossierId) : "";
        return {
            summary: `${labels[action]}${dossierName ? ` — hồ sơ "${dossierName}"` : ""}`,
            entityType: "issue_report",
            entityId: reportId,
            details: {
                reportId,
                dossierId,
                dossierName,
                status: response?.status,
            },
        };
    };
}

export function enrichDossierCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => Promise<AuditRouteEnrichResult | null> {
    const prefix = operation === "create"
        ? "Tạo hồ sơ"
        : operation === "update"
        ? "Cập nhật hồ sơ"
        : "Xóa hồ sơ";
    return async (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(response);
        const id = String(record?.id ?? ctx.params.id ?? "");
        const dossierName = id ? await loadDossierLabel(id) : "";
        return {
            summary: `${prefix} "${dossierName || id}"`,
            entityType: "dossier",
            entityId: id || null,
            details: { dossierId: id, dossierName },
        };
    };
}

export function enrichArchiveAclCrud(
    operation: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    const prefix = operation === "create"
        ? "Tạo quy tắc ACL kho"
        : operation === "update"
        ? "Cập nhật quy tắc ACL kho"
        : "Xóa quy tắc ACL kho";
    return (ctx) => {
        const response = asRecord(ctx.response);
        const record = asRecord(response?.record) ?? asRecord(ctx.body);
        const id = String(record?.id ?? ctx.params.id ?? "");
        return {
            summary: `${prefix}`,
            entityType: "archive_acl",
            entityId: id || null,
            details: { id, ...record },
        };
    };
}

export function enrichSecurityLevelVerify(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const body = asRecord(ctx.body);
    const levelId = String(body?.levelId ?? ctx.params.id ?? "");
    return {
        summary: "Xác minh mật khẩu cấp độ bảo mật",
        entityType: "security_level",
        entityId: levelId || null,
        details: { levelId },
    };
}

function resolveBorrowRequestId(ctx: AuditRouteEnrichContext): string {
    const response = asRecord(ctx.response);
    return String(response?.id ?? ctx.params.id ?? "");
}

export function enrichArchiveBorrowCreate(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const response = asRecord(ctx.response);
    const body = asRecord(ctx.body);
    const id = resolveBorrowRequestId(ctx);
    if (!id) return null;

    const items = Array.isArray(response?.items) ? response.items : [];
    return {
        summary: `Tạo phiếu mượn điện tử ${id}`,
        entityType: "archive_borrow_request",
        entityId: id,
        details: {
            itemCount: items.length,
            requestedFrom: body?.requestedFrom ?? response?.requestedFrom ?? null,
            requestedUntil: body?.requestedUntil ?? response?.requestedUntil ?? null,
        },
    };
}

export function enrichArchiveBorrowApprove(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const body = asRecord(ctx.body);
    const id = resolveBorrowRequestId(ctx);
    if (!id) return null;

    return {
        summary: `Duyệt phiếu mượn ${id}`,
        entityType: "archive_borrow_request",
        entityId: id,
        details: {
            approvedFrom: body?.approvedFrom ?? null,
            approvedUntil: body?.approvedUntil ?? null,
        },
    };
}

export function enrichArchiveBorrowReject(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const id = resolveBorrowRequestId(ctx);
    if (!id) return null;

    return {
        summary: `Từ chối phiếu mượn ${id}`,
        entityType: "archive_borrow_request",
        entityId: id,
    };
}

export function enrichArchiveBorrowRegenerateDip(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const id = resolveBorrowRequestId(ctx);
    if (!id) return null;

    return {
        summary: `Tạo lại DIP phiếu mượn ${id}`,
        entityType: "archive_borrow_request",
        entityId: id,
    };
}

export function enrichArchiveBorrowActivate(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const id = resolveBorrowRequestId(ctx);
    if (!id) return null;

    return {
        summary: `Kích hoạt xem phiếu mượn ${id}`,
        entityType: "archive_borrow_request",
        entityId: id,
    };
}

export function enrichArchiveBorrowViewDocument(
    ctx: AuditRouteEnrichContext,
): AuditRouteEnrichResult | null {
    const requestId = ctx.params.id;
    const fileId = ctx.params.fileId;
    if (!requestId || !fileId) return null;

    return {
        summary: `Xem DIP file ${fileId} của phiếu ${requestId}`,
        entityType: "archive_borrow_request",
        entityId: requestId,
        details: { fileId },
    };
}

export function enrichProjectPlanCrud(
    op: "create" | "update" | "delete",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    return (ctx: AuditRouteEnrichContext) => {
        const body = asRecord(ctx.body);
        const res = asRecord(ctx.response);
        const id = String(res?.id ?? ctx.params.id ?? body?.id ?? "");
        const name = String(body?.name ?? res?.name ?? body?.planName ?? res?.planName ?? id);
        const actionLabel = op === "create" ? "Tạo kế hoạch dự án" : op === "update" ? "Cập nhật kế hoạch dự án" : "Xóa kế hoạch dự án";
        return {
            summary: `${actionLabel} "${name}"`,
            entityType: "project_plan",
            entityId: id || null,
        };
    };
}

export function enrichArchiveDisposalAction(
    action: "create" | "update" | "submit" | "council_create" | "council_finalize" | "council_publish" | "destroy",
): (ctx: AuditRouteEnrichContext) => AuditRouteEnrichResult | null {
    return (ctx: AuditRouteEnrichContext) => {
        const body = asRecord(ctx.body);
        const res = asRecord(ctx.response);
        const id = String(res?.id ?? ctx.params.id ?? body?.id ?? "");
        const title = String(res?.title ?? body?.title ?? res?.name ?? body?.name ?? id);

        const labels: Record<string, string> = {
            create: "Tạo đề xuất hủy",
            update: "Cập nhật đề xuất hủy",
            submit: "Trình duyệt đề xuất hủy",
            council_create: "Tạo Hội đồng xét hủy",
            council_finalize: "Phê duyệt kết quả Hội đồng xét hủy",
            council_publish: "Xuất bản Quyết định Hội đồng",
            destroy: "Thực hiện hủy danh mục hồ sơ",
        };
        const label = labels[action] || action;
        return {
            summary: title ? `${label} "${title}"` : label,
            entityType: "archive_disposal",
            entityId: id || null,
        };
    };
}