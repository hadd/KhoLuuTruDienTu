import { eq } from "drizzle-orm";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    formatDossierLabel,
} from "./warehouse-audit.ts";
import type { AuditRouteEnrichContext, AuditRouteEnrichResult } from "./audit-route-types.ts";

async function loadDossierLabel(dossierId: string): Promise<string> {
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
