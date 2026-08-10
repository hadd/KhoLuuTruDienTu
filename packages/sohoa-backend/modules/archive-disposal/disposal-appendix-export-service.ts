import { eq, inArray } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import JSZip from "jszip";

import { db } from "../../db/db-conn.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
} from "../../db/schemas/archive-disposal.ts";
import { DisposalProposalItemSource } from "../../db/schemas/archive-disposal-constants.ts";
import type { DisposalProposalItemSourceType } from "../../db/schemas/archive-disposal-constants.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { fonds } from "../../db/schemas/fond.ts";
import { parseDossierMetadata } from "../../libs/metadata-normalize.ts";
import type { DossierMetadata } from "../../libs/metadata-types.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import {
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
} from "../data-entry/data-entry-s3-utils.ts";

import { assertCanAccessDisposalCatalog } from "./archive-disposal-catalog-access.ts";
import {
    type AppendixCatalogRow,
    loadAppendixTemplate,
    renderDocxTemplate,
} from "./disposal-appendix-docx.ts";
import { convertDocxToPdfWithFallback } from "./disposal-docx-to-pdf.ts";
import {
    buildPhuLucIIPdfFallback,
    buildPhuLucIIIPdfFallback,
} from "./disposal-appendix-pdf-fallback.ts";
import { extractAppendixRowMetadata } from "./disposal-appendix-metadata.ts";
import { DISPOSAL_APPENDIX_CIRCULAR_LABEL } from "./disposal-appendix-metadata-keys.ts";

type CatalogItemRow = {
    id: string;
    dossierId: string;
    fileId: string | null;
    source: DisposalProposalItemSourceType;
    reason: string;
    notes: string;
    dossierName: string;
    fileName: string | null;
    fondId: string | null;
    fondName: string | null;
    currentMetadataKey: string | null;
};

type FondBundle = {
    fondId: string;
    fondName: string;
    fondAgency: string;
    fondHistory: string;
    items: CatalogItemRow[];
};

export type AppendixExportFile = {
    filename: string;
    pdfBytes: Uint8Array;
};

function disposalReasonLabel(source: DisposalProposalItemSourceType, reason: string): string {
    if (source === DisposalProposalItemSource.DUPLICATE) return "Trùng lặp";
    if (
        source === DisposalProposalItemSource.EXPIRED ||
        source === DisposalProposalItemSource.EXPIRING_SOON
    ) {
        return "Hết thời hạn lưu trữ";
    }
    return reason.trim() || "Hết thời hạn lưu trữ";
}

async function loadMetadataMap(
    dossierIds: string[],
): Promise<Map<string, DossierMetadata | null>> {
    const map = new Map<string, DossierMetadata | null>();
    if (dossierIds.length === 0) return map;

    const rows = await db.select({
        id: dossiers.id,
        currentMetadataKey: dossiers.currentMetadataKey,
    })
        .from(dossiers)
        .where(inArray(dossiers.id, dossierIds));

    await Promise.all(rows.map(async (row) => {
        if (!row.currentMetadataKey) {
            map.set(row.id, null);
            return;
        }
        try {
            const key = resolveMetadataJsonKey(row.currentMetadataKey);
            const raw = await downloadJsonFromStorage(key);
            map.set(row.id, parseDossierMetadata(raw));
        } catch {
            map.set(row.id, null);
        }
    }));

    return map;
}

function buildItemTitle(item: CatalogItemRow, meta: ReturnType<typeof extractAppendixRowMetadata>): string {
    if (meta.metadataTitle) return meta.metadataTitle;
    if (item.fileName) return `${item.dossierName} / ${item.fileName}`;
    if (meta.archiveNumber) return `${item.dossierName}; ${meta.archiveNumber}`;
    return item.dossierName;
}

function buildPl3CountsDetail(items: CatalogItemRow[]): string {
    const dossierIds = new Set(items.map((i) => i.dossierId));
    const fileRows = items.filter((i) => i.fileId != null).length;
    const expired = items.filter((i) =>
        i.source === DisposalProposalItemSource.EXPIRED ||
        i.source === DisposalProposalItemSource.EXPIRING_SOON
    ).length;
    const duplicate = items.filter((i) => i.source === DisposalProposalItemSource.DUPLICATE).length;
    return [
        `- Tổng số tài liệu đưa ra xác định lại giá trị: ${items.length} (hồ sơ: ${dossierIds.size})`,
        `- Tổng số tài liệu giấy đưa ra chỉnh lý: ${fileRows || items.length}`,
        `- Tài liệu giữ lại bảo quản: 0`,
        `- Tài liệu hết thời hạn lưu trữ, trùng lặp: ${expired + duplicate}`,
    ].join("\n");
}

function summarizeGroup(items: CatalogItemRow[], sources: DisposalProposalItemSourceType[]): string {
    const filtered = items.filter((i) => sources.includes(i.source));
    if (filtered.length === 0) return "Không có.";
    const lines = filtered.slice(0, 15).map((i) =>
        i.fileName ? `- ${i.dossierName} / ${i.fileName}` : `- ${i.dossierName}`
    );
    if (filtered.length > 15) lines.push(`- … và ${filtered.length - 15} mục khác`);
    return lines.join("\n");
}

async function buildFondBundles(catalogId: string): Promise<FondBundle[]> {
    const items = await db.select({
        id: disposalProposalItems.id,
        dossierId: disposalProposalItems.dossierId,
        fileId: disposalProposalItems.fileId,
        source: disposalProposalItems.source,
        reason: disposalProposalItems.reason,
        notes: disposalProposalItems.notes,
        dossierName: dossiers.name,
        fileName: dossierFiles.fileName,
        fondId: dossiers.fondId,
        fondName: fonds.fondName,
        currentMetadataKey: dossiers.currentMetadataKey,
    })
        .from(disposalProposalItems)
        .innerJoin(dossiers, eq(dossiers.id, disposalProposalItems.dossierId))
        .leftJoin(fonds, eq(fonds.id, dossiers.fondId))
        .leftJoin(dossierFiles, eq(dossierFiles.id, disposalProposalItems.fileId))
        .where(eq(disposalProposalItems.catalogId, catalogId));

    if (items.length === 0) {
        throw httpError.conflict("Danh mục không có hồ sơ/tài liệu để xuất Phụ lục");
    }

    const fondMeta = new Map<string, { agency: string; history: string }>();
    const fondIds = [...new Set(items.map((i) => i.fondId).filter(Boolean))] as string[];
    if (fondIds.length > 0) {
        const fondRows = await db.select({
            id: fonds.id,
            archiveAgency: fonds.archiveAgency,
            adminstrativeHistory: fonds.adminstrativeHistory,
        }).from(fonds).where(inArray(fonds.id, fondIds));
        for (const f of fondRows) {
            fondMeta.set(f.id, { agency: f.archiveAgency, history: f.adminstrativeHistory });
        }
    }

    const distinctFondIds = [
        ...new Set(
            items.map((i) => i.fondId?.trim()).filter((id): id is string => Boolean(id)),
        ),
    ];
    const soleFondId = distinctFondIds.length === 1 ? distinctFondIds[0]! : null;

    const byFond = new Map<string, CatalogItemRow[]>();
    for (const item of items) {
        const trimmedFondId = item.fondId?.trim();
        const key = trimmedFondId || (soleFondId ?? "__none__");
        const list = byFond.get(key) ?? [];
        list.push(item as CatalogItemRow);
        byFond.set(key, list);
    }

    return [...byFond.entries()].map(([fondId, fondItems]) => {
        const meta = fondId !== "__none__" ? fondMeta.get(fondId) : undefined;
        return {
            fondId,
            fondName: fondItems[0]?.fondName ?? "Chưa gán phông",
            fondAgency: meta?.agency ?? "",
            fondHistory: meta?.history ?? "",
            items: fondItems,
        };
    });
}

async function renderAppendixIIForFond(
    bundle: FondBundle,
    metadataByDossier: Map<string, DossierMetadata | null>,
): Promise<Uint8Array> {
    const template = await loadAppendixTemplate("phu-luc-ii-danh-muc.docx");
    const tableRows: AppendixCatalogRow[] = bundle.items.map((item) => {
        const meta = extractAppendixRowMetadata(metadataByDossier.get(item.dossierId) ?? null);
        return {
            boxNumber: meta.boxNumber,
            volumeNumber: meta.volumeNumber,
            title: buildItemTitle(item, meta),
            disposalReasonLabel: disposalReasonLabel(item.source, item.reason),
            notes: item.notes.trim(),
        };
    });
    const docx = renderDocxTemplate(template, {
        fondName: bundle.fondName,
        circularLabel: DISPOSAL_APPENDIX_CIRCULAR_LABEL,
    }, { tableRows });
    return await convertDocxToPdfWithFallback(docx, () =>
        buildPhuLucIIPdfFallback({
            fondName: bundle.fondName,
            rows: tableRows,
        })
    );
}

async function renderAppendixIIIForFond(
    bundle: FondBundle,
    catalogDate: string,
): Promise<Uint8Array> {
    const template = await loadAppendixTemplate("phu-luc-iii-thuyet-minh.docx");
    const formation = [
        bundle.fondHistory.trim(),
        bundle.fondAgency ? `Cơ quan lưu trữ: ${bundle.fondAgency}` : "",
    ].filter(Boolean).join("\n") || "Theo hồ sơ phông lưu trữ.";
    const countsDetail = buildPl3CountsDetail(bundle.items);
    const expiredGroupSummary = summarizeGroup(bundle.items, [
        DisposalProposalItemSource.EXPIRED,
        DisposalProposalItemSource.EXPIRING_SOON,
    ]);
    const duplicateGroupSummary = summarizeGroup(bundle.items, [
        DisposalProposalItemSource.DUPLICATE,
    ]);

    const docx = renderDocxTemplate(template, {
        fondName: bundle.fondName,
        circularLabel: DISPOSAL_APPENDIX_CIRCULAR_LABEL,
        formationHeading: `1. Sự hình thành khối tài liệu hết thời hạn lưu trữ, trùng lặp\n${formation}`,
        countsHeading: `2. Số lượng tài liệu:\n${countsDetail}`,
        timeRangeText: `3. Thời gian: ${catalogDate} (theo danh mục đề xuất hủy)`,
        expiredGroupSummary,
        duplicateGroupHeading: "2. Nhóm tài liệu trùng lặp",
        duplicateGroupSummary,
        otherGroupSummary: "3. Các nhóm tài liệu khác (nếu có): Không.",
    });
    return await convertDocxToPdfWithFallback(docx, () =>
        buildPhuLucIIIPdfFallback({
            fondName: bundle.fondName,
            formationText: formation,
            countsDetail,
            timeRangeText: `3. Thời gian: ${catalogDate} (theo danh mục đề xuất hủy)`,
            expiredGroupSummary,
            duplicateGroupSummary,
            otherGroupSummary: "3. Các nhóm tài liệu khác (nếu có): Không.",
        })
    );
}

function safeFilenamePart(value: string): string {
    return value.replace(/[^\w\-]+/g, "_").slice(0, 40);
}

async function packPdfResults(
    files: AppendixExportFile[],
    catalogCode: string,
    appendix: "ii" | "iii",
): Promise<{ body: Uint8Array; contentType: string; filename: string }> {
    if (files.length === 1) {
        return {
            body: files[0]!.pdfBytes,
            contentType: "application/pdf",
            filename: files[0]!.filename,
        };
    }
    const zip = new JSZip();
    for (const f of files) zip.file(f.filename, f.pdfBytes);
    const body = await zip.generateAsync({ type: "uint8array" });
    const zipName = appendix === "ii"
        ? `phu-luc-ii-danh-muc-${catalogCode}.zip`
        : `phu-luc-iii-thuyet-minh-${catalogCode}.zip`;
    return {
        body,
        contentType: "application/zip",
        filename: zipName,
    };
}

export const DisposalAppendixExportService = {
    async exportPhuLucII(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const [catalog] = await db.select({
            code: disposalProposalCatalogs.code,
        }).from(disposalProposalCatalogs).where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");

        const bundles = await buildFondBundles(catalogId);
        const dossierIds = [...new Set(bundles.flatMap((b) => b.items.map((i) => i.dossierId)))];
        const metadataByDossier = await loadMetadataMap(dossierIds);

        const files: AppendixExportFile[] = [];
        const usedFilenames = new Set<string>();
        for (const bundle of bundles) {
            const pdfBytes = await renderAppendixIIForFond(bundle, metadataByDossier);
            const fondPart = safeFilenamePart(bundle.fondName);
            let filename = bundles.length > 1
                ? `phu-luc-ii-danh-muc-${catalog.code}-${fondPart}.pdf`
                : `phu-luc-ii-danh-muc-${catalog.code}.pdf`;
            if (usedFilenames.has(filename)) {
                const suffix = safeFilenamePart(bundle.fondId === "__none__" ? bundle.fondName : bundle.fondId);
                filename = `phu-luc-ii-danh-muc-${catalog.code}-${fondPart}-${suffix}.pdf`;
            }
            usedFilenames.add(filename);
            files.push({ filename, pdfBytes });
        }
        return packPdfResults(files, catalog.code, "ii");
    },

    async exportPhuLucIII(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const [catalog] = await db.select({
            code: disposalProposalCatalogs.code,
            catalogDate: disposalProposalCatalogs.catalogDate,
        }).from(disposalProposalCatalogs).where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");

        const bundles = await buildFondBundles(catalogId);
        const catalogDate = catalog.catalogDate.toISOString().slice(0, 10);

        const files: AppendixExportFile[] = [];
        const usedFilenames = new Set<string>();
        for (const bundle of bundles) {
            const pdfBytes = await renderAppendixIIIForFond(bundle, catalogDate);
            const fondPart = safeFilenamePart(bundle.fondName);
            let filename = bundles.length > 1
                ? `phu-luc-iii-thuyet-minh-${catalog.code}-${fondPart}.pdf`
                : `phu-luc-iii-thuyet-minh-${catalog.code}.pdf`;
            if (usedFilenames.has(filename)) {
                const suffix = safeFilenamePart(bundle.fondId === "__none__" ? bundle.fondName : bundle.fondId);
                filename = `phu-luc-iii-thuyet-minh-${catalog.code}-${fondPart}-${suffix}.pdf`;
            }
            usedFilenames.add(filename);
            files.push({ filename, pdfBytes });
        }
        return packPdfResults(files, catalog.code, "iii");
    },
};
