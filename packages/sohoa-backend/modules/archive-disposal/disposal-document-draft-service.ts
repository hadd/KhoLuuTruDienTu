import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";

import { db } from "../../db/db-conn.ts";
import {
    DisposalAppraisalDocumentType,
    type DisposalAppraisalDocumentTypeType,
} from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalCatalogDocumentDrafts,
    disposalCatalogPl3Content,
} from "../../db/schemas/archive-disposal.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { downloadBinaryFromStorage } from "../data-entry/data-entry-s3-utils.ts";
import { uploadSignedPdfToStorage } from "../digital-sign/digital-sign-s3-utils.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";

import { assertCanAccessDisposalCatalog } from "./archive-disposal-catalog-access.ts";
import { DisposalAppendixExportService } from "./disposal-appendix-export-service.ts";
import {
    formatPl3ExpiredGroupBlock,
    formatPl3FormationHeading,
    formatPl3OtherGroupBlock,
    mapPl3ContentToDocxData,
} from "./disposal-appendix-pl3-content.ts";
import type { Pl3Content } from "./disposal-appendix-pl3-types.ts";
import { fillAssetDocxBodyOrPlain, buildPlainTextDocx } from "./disposal-asset-docx.ts";
import { renderTipTapIntoAssetDocx } from "./disposal-docx-blocks.ts";
import {
    buildPl3TipTap,
    type TipTapDocument,
} from "./disposal-document-tiptap.ts";
import { buildMinutesPdfDataForCatalog } from "./disposal-minutes-data.ts";
import {
    buildCouncilMinutesDocxFromData,
    buildDestructionMinutesDocxFromData,
} from "./disposal-minutes-docx.ts";
import { convertDocxToPdfWithFallback } from "./disposal-docx-to-pdf.ts";
import { buildCouncilMinutesPdf, buildDestructionMinutesPdf } from "./disposal-minutes-pdf.ts";

export type EditableAppraisalDocumentSlug =
    | "pl3"
    | "minutes-council"
    | "minutes-destruction";

export type DocumentDraftResponse = {
    documentType: DisposalAppraisalDocumentTypeType;
    contentJson: TipTapDocument;
    sourceHash: string | null;
    currentSourceHash: string;
    sourceStale: boolean;
    hasUploadedDocx: boolean;
    updatedAt: string | null;
};

function isUploadedDocxStorageKey(key: string | null | undefined): boolean {
    return Boolean(key?.includes("-upload-"));
}

async function renderDraftDocxFromContent(
    slug: EditableAppraisalDocumentSlug,
    content: TipTapDocument,
): Promise<Uint8Array> {
    switch (slug) {
        case "minutes-council":
            return await renderTipTapIntoAssetDocx("MINUTES_COUNCIL", content);
        case "minutes-destruction":
            return await renderTipTapIntoAssetDocx("MINUTES_DESTRUCTION", content);
        case "pl3":
            return await renderTipTapIntoAssetDocx("PL3_MASTER", content);
    }
}

function slugToDocumentType(slug: EditableAppraisalDocumentSlug): DisposalAppraisalDocumentTypeType {
    switch (slug) {
        case "pl3":
            return DisposalAppraisalDocumentType.PL3;
        case "minutes-council":
            return DisposalAppraisalDocumentType.MINUTES_COUNCIL;
        case "minutes-destruction":
            return DisposalAppraisalDocumentType.MINUTES_DESTRUCTION;
    }
}

function hashPayload(payload: unknown): string {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

async function computeSourceHash(
    profile: UserWithRoles,
    catalogId: string,
    documentType: DisposalAppraisalDocumentTypeType,
): Promise<string> {
    if (documentType === DisposalAppraisalDocumentType.PL3) {
        const suggestions = await DisposalAppendixExportService.getPl3Suggestions(profile, catalogId);
        return hashPayload(suggestions.content);
    }
    const data = await buildMinutesPdfDataForCatalog(catalogId);
    return hashPayload({
        councilCode: data.councilDetail.council.code,
        outcomes: data.outcomes,
        evaluations: data.evaluations.map((e) => ({
            itemId: e.itemLabel,
            decision: e.decision,
            note: e.note,
        })),
        members: data.members,
    });
}

async function generatePl3Draft(profile: UserWithRoles, catalogId: string): Promise<{
    contentJson: TipTapDocument;
    docxBytes: Uint8Array;
    sourceHash: string;
}> {
    const suggestions = await DisposalAppendixExportService.getPl3Suggestions(profile, catalogId);
    const [legacy] = await db.select({ content: disposalCatalogPl3Content.content })
        .from(disposalCatalogPl3Content)
        .where(eq(disposalCatalogPl3Content.catalogId, catalogId))
        .limit(1);
    const pl3 = (legacy?.content as Pl3Content | undefined) ?? suggestions.content;
    const docxData = mapPl3ContentToDocxData(
        suggestions.fondName,
        "Thông tư 06/2025/TT-BNV",
        pl3,
    );
    const contentJson = buildPl3TipTap({
        fondName: suggestions.fondName,
        formationHeading: formatPl3FormationHeading(pl3),
        countsHeading: docxData.countsHeading,
        timeRangeText: pl3.timeRangeText.trim(),
        expiredGroupBlock: formatPl3ExpiredGroupBlock(pl3),
        duplicateGroupBlock: pl3.duplicateGroupSummary.trim(),
        otherGroupBlock: formatPl3OtherGroupBlock(pl3),
    });
    const plainBody = [
        docxData.formationHeading,
        docxData.countsHeading,
        docxData.timeRangeText,
        docxData.expiredGroupSummary,
        docxData.duplicateGroupSummary,
        docxData.otherGroupSummary,
    ].join("\n\n");
    let docxBytes: Uint8Array;
    try {
        docxBytes = await fillAssetDocxBodyOrPlain(
            "PL3_MASTER",
            { ...docxData, body: plainBody },
            plainBody,
            "BẢN THUYẾT MINH TÀI LIỆU",
        );
    } catch {
        docxBytes = buildPlainTextDocx(plainBody, "BẢN THUYẾT MINH TÀI LIỆU");
    }
    return {
        contentJson,
        docxBytes,
        sourceHash: hashPayload(pl3),
    };
}

async function generateMinutesCouncilDraft(catalogId: string) {
    const data = await buildMinutesPdfDataForCatalog(catalogId);
    const summaryLine =
        `Hội đồng họp xét hủy danh mục ${data.catalog.code} với ${data.outcomes.length} đơn vị đánh giá, ` +
        `trong đó ${data.destroyCount} đơn vị kết luận hủy.`;
    const { docx, tipTap } = await buildCouncilMinutesDocxFromData({
        councilCode: data.councilDetail.council.code,
        catalogCode: data.catalog.code,
        catalogName: data.catalog.name,
        meetingDate: data.meetingDate,
        members: data.members,
        outcomes: data.outcomes,
        evaluations: data.evaluations,
        summaryLine,
    });
    return {
        contentJson: tipTap,
        docxBytes: docx,
        sourceHash: hashPayload({ outcomes: data.outcomes, members: data.members }),
    };
}

async function generateMinutesDestructionDraft(catalogId: string) {
    const data = await buildMinutesPdfDataForCatalog(catalogId);
    const destructionSummary =
        `Căn cứ kết quả họp Hội đồng xét hủy, đề nghị hủy ${data.destroyCount} hồ sơ/tài liệu ` +
        `trong danh mục ${data.catalog.code} đã hết thời hạn lưu trữ hoặc trùng lặp.`;
    const { docx, tipTap } = await buildDestructionMinutesDocxFromData({
        councilCode: data.councilDetail.council.code,
        catalogCode: data.catalog.code,
        catalogName: data.catalog.name,
        meetingDate: data.meetingDate,
        members: data.members,
        outcomes: data.outcomes,
        destructionSummary,
        destroyCount: data.destroyCount,
    });
    return {
        contentJson: tipTap,
        docxBytes: docx,
        sourceHash: hashPayload({ outcomes: data.outcomes, members: data.members }),
    };
}

async function generateDraft(
    profile: UserWithRoles,
    catalogId: string,
    documentType: DisposalAppraisalDocumentTypeType,
) {
    switch (documentType) {
        case DisposalAppraisalDocumentType.PL3:
            return await generatePl3Draft(profile, catalogId);
        case DisposalAppraisalDocumentType.MINUTES_COUNCIL:
            return await generateMinutesCouncilDraft(catalogId);
        case DisposalAppraisalDocumentType.MINUTES_DESTRUCTION:
            return await generateMinutesDestructionDraft(catalogId);
        default:
            throw httpError.badRequest("Loại văn bản không hỗ trợ soạn thảo");
    }
}

async function upsertDraftRow(
    catalogId: string,
    documentType: DisposalAppraisalDocumentTypeType,
    contentJson: TipTapDocument,
    sourceHash: string,
    userId: string,
    docxStorageKey?: string | null,
) {
    const now = new Date();
    await db.insert(disposalCatalogDocumentDrafts).values({
        catalogId,
        documentType,
        contentJson,
        sourceHash,
        generatedAt: now,
        docxStorageKey: docxStorageKey ?? null,
        updatedBy: userId,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: [
            disposalCatalogDocumentDrafts.catalogId,
            disposalCatalogDocumentDrafts.documentType,
        ],
        set: {
            contentJson,
            sourceHash,
            generatedAt: now,
            ...(docxStorageKey !== undefined ? { docxStorageKey } : {}),
            updatedBy: userId,
            updatedAt: now,
        },
    });
}

export const DisposalDocumentDraftService = {
    slugToDocumentType,

    async getDraft(
        profile: UserWithRoles,
        catalogId: string,
        slug: EditableAppraisalDocumentSlug,
    ): Promise<DocumentDraftResponse> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const documentType = slugToDocumentType(slug);
        const currentSourceHash = await computeSourceHash(profile, catalogId, documentType);

        const [row] = await db.select()
            .from(disposalCatalogDocumentDrafts)
            .where(and(
                eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                eq(disposalCatalogDocumentDrafts.documentType, documentType),
            ))
            .limit(1);

        if (!row) {
            const generated = await generateDraft(profile, catalogId, documentType);
            await upsertDraftRow(
                catalogId,
                documentType,
                generated.contentJson,
                generated.sourceHash,
                profile.id,
            );
            return {
                documentType,
                contentJson: generated.contentJson,
                sourceHash: generated.sourceHash,
                currentSourceHash,
                sourceStale: false,
                hasUploadedDocx: false,
                updatedAt: new Date().toISOString(),
            };
        }

        return {
            documentType,
            contentJson: row.contentJson as TipTapDocument,
            sourceHash: row.sourceHash,
            currentSourceHash,
            sourceStale: Boolean(row.sourceHash && row.sourceHash !== currentSourceHash),
            hasUploadedDocx: isUploadedDocxStorageKey(row.docxStorageKey),
            updatedAt: row.updatedAt.toISOString(),
        };
    },

    async saveDraftContent(
        profile: UserWithRoles,
        catalogId: string,
        slug: EditableAppraisalDocumentSlug,
        contentJson: TipTapDocument,
    ): Promise<void> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const documentType = slugToDocumentType(slug);
        const [existing] = await db.select()
            .from(disposalCatalogDocumentDrafts)
            .where(and(
                eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                eq(disposalCatalogDocumentDrafts.documentType, documentType),
            ))
            .limit(1);
        const now = new Date();
        if (existing) {
            const clearGeneratedDocx = existing.docxStorageKey
                && !isUploadedDocxStorageKey(existing.docxStorageKey);
            await db.update(disposalCatalogDocumentDrafts)
                .set({
                    contentJson,
                    updatedBy: profile.id,
                    updatedAt: now,
                    ...(clearGeneratedDocx ? { docxStorageKey: null } : {}),
                })
                .where(and(
                    eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                    eq(disposalCatalogDocumentDrafts.documentType, documentType),
                ));
        } else {
            const generated = await generateDraft(profile, catalogId, documentType);
            await upsertDraftRow(
                catalogId,
                documentType,
                contentJson,
                generated.sourceHash,
                profile.id,
            );
        }
    },

    async regenerateDraft(
        profile: UserWithRoles,
        catalogId: string,
        slug: EditableAppraisalDocumentSlug,
    ): Promise<DocumentDraftResponse> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const documentType = slugToDocumentType(slug);
        const generated = await generateDraft(profile, catalogId, documentType);
        const docxKey = normalizeStorageKey(
            `archive-disposal/catalogs/${catalogId}/drafts/${slug}-${Date.now()}.docx`,
        );
        await uploadSignedPdfToStorage(docxKey, generated.docxBytes);
        await upsertDraftRow(
            catalogId,
            documentType,
            generated.contentJson,
            generated.sourceHash,
            profile.id,
            docxKey,
        );
        const currentSourceHash = await computeSourceHash(profile, catalogId, documentType);
        return {
            documentType,
            contentJson: generated.contentJson,
            sourceHash: generated.sourceHash,
            currentSourceHash,
            sourceStale: false,
            hasUploadedDocx: true,
            updatedAt: new Date().toISOString(),
        };
    },

    async downloadDraftDocx(
        profile: UserWithRoles,
        catalogId: string,
        slug: EditableAppraisalDocumentSlug,
    ): Promise<{ body: Uint8Array; filename: string }> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const documentType = slugToDocumentType(slug);
        const [row] = await db.select()
            .from(disposalCatalogDocumentDrafts)
            .where(and(
                eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                eq(disposalCatalogDocumentDrafts.documentType, documentType),
            ))
            .limit(1);

        if (row?.docxStorageKey && isUploadedDocxStorageKey(row.docxStorageKey)) {
            const body = await downloadBinaryFromStorage(row.docxStorageKey);
            return { body, filename: `${slug}.docx` };
        }

        if (row?.contentJson) {
            const body = await renderDraftDocxFromContent(slug, row.contentJson as TipTapDocument);
            return { body, filename: `${slug}.docx` };
        }

        const generated = await generateDraft(profile, catalogId, documentType);
        const docxKey = normalizeStorageKey(
            `archive-disposal/catalogs/${catalogId}/drafts/${slug}-generated-${Date.now()}.docx`,
        );
        await uploadSignedPdfToStorage(docxKey, generated.docxBytes);
        if (row) {
            await db.update(disposalCatalogDocumentDrafts)
                .set({ docxStorageKey: docxKey, updatedAt: new Date() })
                .where(and(
                    eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                    eq(disposalCatalogDocumentDrafts.documentType, documentType),
                ));
        } else {
            await upsertDraftRow(
                catalogId,
                documentType,
                generated.contentJson,
                generated.sourceHash,
                profile.id,
                docxKey,
            );
        }
        return { body: generated.docxBytes, filename: `${slug}.docx` };
    },

    async uploadDraftDocx(
        profile: UserWithRoles,
        catalogId: string,
        slug: EditableAppraisalDocumentSlug,
        file: File,
    ): Promise<void> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const documentType = slugToDocumentType(slug);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const docxKey = normalizeStorageKey(
            `archive-disposal/catalogs/${catalogId}/drafts/${slug}-upload-${Date.now()}.docx`,
        );
        await uploadSignedPdfToStorage(docxKey, bytes);
        const [existing] = await db.select()
            .from(disposalCatalogDocumentDrafts)
            .where(and(
                eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                eq(disposalCatalogDocumentDrafts.documentType, documentType),
            ))
            .limit(1);
        if (existing) {
            await db.update(disposalCatalogDocumentDrafts)
                .set({
                    docxStorageKey: docxKey,
                    updatedBy: profile.id,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                    eq(disposalCatalogDocumentDrafts.documentType, documentType),
                ));
        } else {
            const generated = await generateDraft(profile, catalogId, documentType);
            await upsertDraftRow(
                catalogId,
                documentType,
                generated.contentJson,
                generated.sourceHash,
                profile.id,
                docxKey,
            );
        }
    },

    async resolveExportPdfBytes(
        profile: UserWithRoles,
        catalogId: string,
        slug: EditableAppraisalDocumentSlug,
    ): Promise<Uint8Array> {
        const documentType = slugToDocumentType(slug);
        const [row] = await db.select()
            .from(disposalCatalogDocumentDrafts)
            .where(and(
                eq(disposalCatalogDocumentDrafts.catalogId, catalogId),
                eq(disposalCatalogDocumentDrafts.documentType, documentType),
            ))
            .limit(1);

        let docxBytes: Uint8Array;
        if (row?.docxStorageKey && isUploadedDocxStorageKey(row.docxStorageKey)) {
            docxBytes = await downloadBinaryFromStorage(row.docxStorageKey);
        } else if (row?.contentJson) {
            docxBytes = await renderDraftDocxFromContent(slug, row.contentJson as TipTapDocument);
        } else {
            const generated = await generateDraft(profile, catalogId, documentType);
            docxBytes = generated.docxBytes;
        }

        return await convertDocxToPdfWithFallback(docxBytes, async () => {
            if (slug === "minutes-council" || slug === "minutes-destruction") {
                const data = await buildMinutesPdfDataForCatalog(catalogId);
                if (slug === "minutes-council") {
                    return await buildCouncilMinutesPdf({
                        title: "BIÊN BẢN Họp Hội đồng xét hủy tài liệu lưu trữ",
                        councilCode: data.councilDetail.council.code,
                        catalogCode: data.catalog.code,
                        catalogName: data.catalog.name,
                        meetingDate: data.meetingDate,
                        members: data.members,
                        outcomes: data.outcomes,
                        evaluations: data.evaluations,
                        summaryLine:
                            `Hội đồng họp xét hủy danh mục ${data.catalog.code} với ${data.outcomes.length} đơn vị đánh giá, ` +
                            `trong đó ${data.destroyCount} đơn vị kết luận hủy.`,
                    });
                }
                return await buildDestructionMinutesPdf({
                    title: "BIÊN BẢN Về việc hủy hồ sơ, tài liệu hết giá trị",
                    councilCode: data.councilDetail.council.code,
                    catalogCode: data.catalog.code,
                    catalogName: data.catalog.name,
                    meetingDate: data.meetingDate,
                    members: data.members,
                    outcomes: data.outcomes,
                    evaluations: data.evaluations,
                    summaryLine: "",
                    destructionSummary:
                        `Căn cứ kết quả họp Hội đồng xét hủy, đề nghị hủy ${data.destroyCount} hồ sơ/tài liệu ` +
                        `trong danh mục ${data.catalog.code} đã hết thời hạn lưu trữ hoặc trùng lặp.`,
                });
            }
            const generated = await generatePl3Draft(profile, catalogId);
            return await convertDocxToPdfWithFallback(generated.docxBytes, async () =>
                new Uint8Array()
            );
        });
    },
};
