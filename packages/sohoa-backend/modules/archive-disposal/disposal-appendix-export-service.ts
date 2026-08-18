import { eq, inArray } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import JSZip from "jszip";

import { db } from "../../db/db-conn.ts";
import {
    disposalProposalCatalogs,
    disposalProposalItems,
} from "../../db/schemas/archive-disposal.ts";
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
    loadAppendixTemplate,
    renderDocxTemplate,
} from "./disposal-appendix-docx.ts";
import { convertDocxToPdfWithFallback } from "./disposal-docx-to-pdf.ts";
import {
    buildPhuLucIIPdfFallback,
    buildPhuLucIIIPdfFallback,
} from "./disposal-appendix-pdf-fallback.ts";
import { DISPOSAL_APPENDIX_CIRCULAR_LABEL } from "./disposal-appendix-metadata-keys.ts";
import {
    buildPl2CatalogRows,
    type Pl2CatalogItemRow,
} from "./disposal-appendix-pl2-rows.ts";
import { loadPhysicalBoxNumbersByDossierIds } from "./disposal-appendix-pl2-box-loader.ts";
import {
    formatPl3ExpiredGroupBlock,
    formatPl3FormationBody,
    formatPl3OtherGroupBlock,
    listPl3ContentValidationErrors,
    mapPl3ContentToDocxData,
} from "./disposal-appendix-pl3-content.ts";
import { buildPl3Suggestions } from "./disposal-appendix-pl3-suggestions.ts";
import type { Pl3Content, Pl3SuggestionsResponse } from "./disposal-appendix-pl3-types.ts";

type CatalogItemRow = Pl2CatalogItemRow & {
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

function assertPl3ContentValid(content: Pl3Content): void {
    const errors = listPl3ContentValidationErrors(content);
    if (errors[0]) {
        throw httpError.badRequest(`Thiếu nội dung: ${errors[0]}`);
    }
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

async function buildFondBundles(catalogId: string): Promise<FondBundle[]> {
    const items = await db.select({
        id: disposalProposalItems.id,
        dossierId: disposalProposalItems.dossierId,
        fileId: disposalProposalItems.fileId,
        source: disposalProposalItems.source,
        reason: disposalProposalItems.reason,
        notes: disposalProposalItems.notes,
        createdAt: disposalProposalItems.createdAt,
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
    boxByDossier: Map<string, string>,
): Promise<Uint8Array> {
    const template = await loadAppendixTemplate("phu-luc-ii-danh-muc.docx");
    const tableRows = buildPl2CatalogRows(bundle.items, metadataByDossier, boxByDossier);
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
    content: Pl3Content,
): Promise<Uint8Array> {
    const template = await loadAppendixTemplate("phu-luc-iii-thuyet-minh.docx");
    const docxData = mapPl3ContentToDocxData(
        bundle.fondName,
        DISPOSAL_APPENDIX_CIRCULAR_LABEL,
        content,
    );
    const formationText = formatPl3FormationBody(content);

    const docx = renderDocxTemplate(template, docxData, { normalizePl3: true });
    return await convertDocxToPdfWithFallback(docx, () =>
        buildPhuLucIIIPdfFallback({
            fondName: bundle.fondName,
            formationText,
            countsDetail: content.countsDetail.trim(),
            timeRangeText: content.timeRangeText.trim(),
            expiredGroupSummary: formatPl3ExpiredGroupBlock(content),
            duplicateGroupSummary: content.duplicateGroupSummary.trim(),
            otherGroupSummary: formatPl3OtherGroupBlock(content),
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
        const [metadataByDossier, boxByDossier] = await Promise.all([
            loadMetadataMap(dossierIds),
            loadPhysicalBoxNumbersByDossierIds(dossierIds),
        ]);

        const files: AppendixExportFile[] = [];
        const usedFilenames = new Set<string>();
        for (const bundle of bundles) {
            const pdfBytes = await renderAppendixIIForFond(
                bundle,
                metadataByDossier,
                boxByDossier,
            );
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

    async getPl3Suggestions(
        profile: UserWithRoles,
        catalogId: string,
    ): Promise<Pl3SuggestionsResponse> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const [catalog] = await db.select({
            code: disposalProposalCatalogs.code,
            catalogDate: disposalProposalCatalogs.catalogDate,
        }).from(disposalProposalCatalogs).where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");

        const bundles = await buildFondBundles(catalogId);
        const bundle = bundles[0]!;
        const dossierIds = [...new Set(bundle.items.map((i) => i.dossierId))];
        const metadataByDossier = await loadMetadataMap(dossierIds);
        const catalogDate = catalog.catalogDate.toISOString().slice(0, 10);

        return {
            fondName: bundle.fondName,
            content: buildPl3Suggestions({
                fondName: bundle.fondName,
                fondAgency: bundle.fondAgency,
                fondHistory: bundle.fondHistory,
                catalogCode: catalog.code,
                catalogDate,
                items: bundle.items,
                metadataByDossier,
            }),
        };
    },

    async exportPhuLucIII(
        profile: UserWithRoles,
        catalogId: string,
        content: Pl3Content,
    ) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        assertPl3ContentValid(content);

        const [catalog] = await db.select({
            code: disposalProposalCatalogs.code,
        }).from(disposalProposalCatalogs).where(eq(disposalProposalCatalogs.id, catalogId)).limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");

        const bundles = await buildFondBundles(catalogId);
        const bundle = bundles[0]!;
        const pdfBytes = await renderAppendixIIIForFond(bundle, content);
        const filename = `phu-luc-iii-thuyet-minh-${catalog.code}.pdf`;
        return {
            body: pdfBytes,
            contentType: "application/pdf",
            filename,
        };
    },
};
