import { and, desc, eq, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";

import { db } from "../../db/db-conn.ts";
import {
    DisposalAppraisalDocumentType,
    DisposalProposalCatalogStatus,
    type DisposalAppraisalDocumentTypeType,
} from "../../db/schemas/archive-disposal-constants.ts";
import {
    disposalAppraisalDocuments,
    disposalAppraisalExportRuns,
    disposalCatalogPl3Content,
    disposalProposalCatalogs,
    disposalReviewCouncils,
} from "../../db/schemas/archive-disposal.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { logActivity } from "../audit-log/audit-log-activity.ts";
import { buildLinkGet } from "../data-entry/data-entry-s3-utils.ts";
import { uploadSignedPdfToStorage } from "../digital-sign/digital-sign-s3-utils.ts";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";

import { assertCanAccessDisposalCatalog } from "./archive-disposal-catalog-access.ts";
import type { Pl3Content } from "./disposal-appendix-pl3-types.ts";
import { DisposalAppendixExportService } from "./disposal-appendix-export-service.ts";
import { DisposalCouncilService } from "./disposal-council-service.ts";
import {
    DisposalDocumentDraftService,
    type EditableAppraisalDocumentSlug,
} from "./disposal-document-draft-service.ts";
import { buildMinutesPdfData } from "./disposal-minutes-data.ts";

async function exportEditableDocumentPdf(
    profile: UserWithRoles,
    catalogId: string,
    slug: EditableAppraisalDocumentSlug,
    filename: string,
    documentType: DisposalAppraisalDocumentTypeType,
) {
    const pdfBytes = await DisposalDocumentDraftService.resolveExportPdfBytes(profile, catalogId, slug);
    const storageKey = normalizeStorageKey(
        `archive-disposal/catalogs/${catalogId}/appraisal/${slug}-${Date.now()}.pdf`,
    );
    await uploadSignedPdfToStorage(storageKey, pdfBytes);
    const { exportedAt, runNumber } = await upsertDocumentDraft(
        catalogId,
        documentType,
        storageKey,
        profile.id,
    );
    return {
        filename,
        contentType: "application/pdf",
        body: pdfBytes,
        exportedAt: exportedAt.toISOString(),
        runNumber,
    };
}

const ALL_DOCUMENT_TYPES: DisposalAppraisalDocumentTypeType[] = [
    DisposalAppraisalDocumentType.PL2,
    DisposalAppraisalDocumentType.PL3,
    DisposalAppraisalDocumentType.MINUTES_COUNCIL,
    DisposalAppraisalDocumentType.MINUTES_DESTRUCTION,
];

const MINUTES_TYPES = new Set<DisposalAppraisalDocumentTypeType>([
    DisposalAppraisalDocumentType.MINUTES_COUNCIL,
    DisposalAppraisalDocumentType.MINUTES_DESTRUCTION,
]);

export type AppraisalDocumentStatus = {
    documentType: DisposalAppraisalDocumentTypeType;
    draftExportedAt: string | null;
    signedUploadedAt: string | null;
    hasDraft: boolean;
    hasSigned: boolean;
};

export type AppraisalDocumentsResponse = {
    catalogId: string;
    catalogCode: string;
    appraisalSubmittedAt: string | null;
    evaluationsLocked: boolean;
    bothMinutesExportedAt: string | null;
    readyToSubmit: boolean;
    missingComponents: string[];
    documents: AppraisalDocumentStatus[];
    exportHistory: Array<{
        id: string;
        documentType: DisposalAppraisalDocumentTypeType;
        runNumber: number;
        createdAt: string;
        createdBy: string;
    }>;
};

function documentTypeLabel(type: DisposalAppraisalDocumentTypeType): string {
    switch (type) {
        case DisposalAppraisalDocumentType.PL2:
            return "Phụ lục II — Danh mục";
        case DisposalAppraisalDocumentType.PL3:
            return "Phụ lục III — Thuyết minh";
        case DisposalAppraisalDocumentType.MINUTES_COUNCIL:
            return "Biên bản Họp Hội đồng xét hủy";
        case DisposalAppraisalDocumentType.MINUTES_DESTRUCTION:
            return "Biên bản Về việc hủy hồ sơ hết giá trị";
    }
}

async function assertAppraisalExportAllowed(catalogId: string) {
    const [catalog] = await db.select({
        appraisalSubmittedAt: disposalProposalCatalogs.appraisalSubmittedAt,
    })
        .from(disposalProposalCatalogs)
        .where(eq(disposalProposalCatalogs.id, catalogId))
        .limit(1);
    if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
    if (catalog.appraisalSubmittedAt) {
        throw httpError.conflict("Danh mục đã gửi thẩm định, không thể kết xuất lại");
    }
}

async function getCouncilForCatalog(catalogId: string) {
    const [council] = await db.select({
        id: disposalReviewCouncils.id,
        code: disposalReviewCouncils.code,
        bothMinutesExportedAt: disposalReviewCouncils.bothMinutesExportedAt,
        decisionPublishedAt: disposalReviewCouncils.decisionPublishedAt,
    })
        .from(disposalReviewCouncils)
        .where(eq(disposalReviewCouncils.catalogId, catalogId))
        .limit(1);
    if (!council) throw httpError.conflict("Danh mục chưa có Hội đồng xét hủy");
    return council;
}

async function assertCouncilEvaluationsComplete(councilId: string) {
    const evalData = await DisposalCouncilService.listCouncilEvaluations(councilId);
    if (!evalData.progress.isComplete) {
        throw httpError.conflict("Hội đồng chưa có đủ kết luận/phiếu đánh giá");
    }
    const pendingChair = evalData.outcomes.some((o) => o.needsChairDecision && !o.chairDecision);
    if (pendingChair) {
        throw httpError.conflict("Còn hồ sơ chờ Chủ tịch quyết định hòa phiếu");
    }
}

async function upsertDocumentDraft(
    catalogId: string,
    documentType: DisposalAppraisalDocumentTypeType,
    storageKey: string,
    userId: string,
) {
    const now = new Date();
    await db.insert(disposalAppraisalDocuments).values({
        catalogId,
        documentType,
        draftStorageKey: storageKey,
        draftExportedAt: now,
        draftExportedBy: userId,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: [disposalAppraisalDocuments.catalogId, disposalAppraisalDocuments.documentType],
        set: {
            draftStorageKey: storageKey,
            draftExportedAt: now,
            draftExportedBy: userId,
            updatedAt: now,
        },
    });

    const [countRow] = await db.select({
        count: sql<number>`count(*)::int`,
    })
        .from(disposalAppraisalExportRuns)
        .where(and(
            eq(disposalAppraisalExportRuns.catalogId, catalogId),
            eq(disposalAppraisalExportRuns.documentType, documentType),
        ));
    const runNumber = (countRow?.count ?? 0) + 1;

    await db.insert(disposalAppraisalExportRuns).values({
        catalogId,
        documentType,
        runNumber,
        storageKey,
        createdBy: userId,
    });

    return { exportedAt: now, runNumber };
}

async function maybeLockCouncilVoting(catalogId: string, councilId: string) {
    const allDocs = await db.select({
        documentType: disposalAppraisalDocuments.documentType,
        draftExportedAt: disposalAppraisalDocuments.draftExportedAt,
    })
        .from(disposalAppraisalDocuments)
        .where(eq(disposalAppraisalDocuments.catalogId, catalogId));

    const councilExported = allDocs.some((d) =>
        d.documentType === DisposalAppraisalDocumentType.MINUTES_COUNCIL && d.draftExportedAt
    );
    const destructionExported = allDocs.some((d) =>
        d.documentType === DisposalAppraisalDocumentType.MINUTES_DESTRUCTION && d.draftExportedAt
    );

    if (councilExported && destructionExported) {
        const now = new Date();
        await db.update(disposalReviewCouncils)
            .set({ bothMinutesExportedAt: now, updatedAt: now })
            .where(and(
                eq(disposalReviewCouncils.id, councilId),
                sql`${disposalReviewCouncils.bothMinutesExportedAt} IS NULL`,
            ));
    }
}

export const DisposalAppraisalExportService = {
    async getAppraisalDocuments(
        profile: UserWithRoles,
        catalogId: string,
    ): Promise<AppraisalDocumentsResponse> {
        await assertCanAccessDisposalCatalog(profile, catalogId);

        const [catalog] = await db.select({
            code: disposalProposalCatalogs.code,
            appraisalSubmittedAt: disposalProposalCatalogs.appraisalSubmittedAt,
        })
            .from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId))
            .limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");

        const docRows = await db.select()
            .from(disposalAppraisalDocuments)
            .where(eq(disposalAppraisalDocuments.catalogId, catalogId));

        const docByType = new Map(docRows.map((r) => [r.documentType, r]));

        const documents: AppraisalDocumentStatus[] = ALL_DOCUMENT_TYPES.map((documentType) => {
            const row = docByType.get(documentType);
            return {
                documentType,
                draftExportedAt: row?.draftExportedAt?.toISOString() ?? null,
                signedUploadedAt: row?.signedUploadedAt?.toISOString() ?? null,
                hasDraft: Boolean(row?.draftStorageKey),
                hasSigned: Boolean(row?.signedStorageKey),
            };
        });

        let evaluationsLocked = false;
        let bothMinutesExportedAt: string | null = null;
        try {
            const council = await getCouncilForCatalog(catalogId);
            bothMinutesExportedAt = council.bothMinutesExportedAt?.toISOString() ?? null;
            evaluationsLocked = Boolean(
                council.bothMinutesExportedAt || council.decisionPublishedAt,
            );
        } catch {
            // no council
        }

        const missingComponents: string[] = [];
        for (const doc of documents) {
            if (!doc.hasDraft) missingComponents.push(documentTypeLabel(doc.documentType));
            if (MINUTES_TYPES.has(doc.documentType) && !doc.hasSigned) {
                missingComponents.push(`${documentTypeLabel(doc.documentType)} (bản ký)`);
            }
        }

        const allDrafts = documents.every((d) => d.hasDraft);
        const allSignedMinutes = documents
            .filter((d) => MINUTES_TYPES.has(d.documentType))
            .every((d) => d.hasSigned);
        const readyToSubmit = allDrafts && allSignedMinutes && !catalog.appraisalSubmittedAt;

        const historyRows = await db.select({
            id: disposalAppraisalExportRuns.id,
            documentType: disposalAppraisalExportRuns.documentType,
            runNumber: disposalAppraisalExportRuns.runNumber,
            createdAt: disposalAppraisalExportRuns.createdAt,
            createdBy: disposalAppraisalExportRuns.createdBy,
        })
            .from(disposalAppraisalExportRuns)
            .where(eq(disposalAppraisalExportRuns.catalogId, catalogId))
            .orderBy(desc(disposalAppraisalExportRuns.createdAt))
            .limit(50);

        return {
            catalogId,
            catalogCode: catalog.code,
            appraisalSubmittedAt: catalog.appraisalSubmittedAt?.toISOString() ?? null,
            evaluationsLocked,
            bothMinutesExportedAt,
            readyToSubmit,
            missingComponents,
            documents,
            exportHistory: historyRows.map((h) => ({
                id: h.id,
                documentType: h.documentType,
                runNumber: h.runNumber,
                createdAt: h.createdAt.toISOString(),
                createdBy: h.createdBy,
            })),
        };
    },

    async getPl3Content(profile: UserWithRoles, catalogId: string): Promise<Pl3Content | null> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const [row] = await db.select({ content: disposalCatalogPl3Content.content })
            .from(disposalCatalogPl3Content)
            .where(eq(disposalCatalogPl3Content.catalogId, catalogId))
            .limit(1);
        return (row?.content as Pl3Content | undefined) ?? null;
    },

    async savePl3Content(
        profile: UserWithRoles,
        catalogId: string,
        content: Pl3Content,
    ): Promise<void> {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        await assertAppraisalExportAllowed(catalogId);
        const now = new Date();
        await db.insert(disposalCatalogPl3Content).values({
            catalogId,
            content,
            updatedBy: profile.id,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: disposalCatalogPl3Content.catalogId,
            set: { content, updatedBy: profile.id, updatedAt: now },
        });
    },

    async exportPl2(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        await assertAppraisalExportAllowed(catalogId);
        const council = await getCouncilForCatalog(catalogId);
        await assertCouncilEvaluationsComplete(council.id);

        const result = await DisposalAppendixExportService.exportPhuLucII(profile, catalogId);
        const ext = result.contentType.includes("zip") ? "zip" : "pdf";
        const storageKey = normalizeStorageKey(
            `archive-disposal/catalogs/${catalogId}/appraisal/pl2-${Date.now()}.${ext}`,
        );
        await uploadSignedPdfToStorage(storageKey, result.body);

        const { exportedAt, runNumber } = await upsertDocumentDraft(
            catalogId,
            DisposalAppraisalDocumentType.PL2,
            storageKey,
            profile.id,
        );

        return {
            filename: result.filename,
            contentType: result.contentType,
            body: result.body,
            exportedAt: exportedAt.toISOString(),
            runNumber,
        };
    },

    async exportPl3(profile: UserWithRoles, catalogId: string, _content?: Pl3Content) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        await assertAppraisalExportAllowed(catalogId);
        const council = await getCouncilForCatalog(catalogId);
        await assertCouncilEvaluationsComplete(council.id);

        const [catalog] = await db.select({ code: disposalProposalCatalogs.code })
            .from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId))
            .limit(1);

        return await exportEditableDocumentPdf(
            profile,
            catalogId,
            "pl3",
            `phu-luc-iii-thuyet-minh-${catalog?.code ?? catalogId}.pdf`,
            DisposalAppraisalDocumentType.PL3,
        );
    },

    async exportMinutesCouncil(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        await assertAppraisalExportAllowed(catalogId);
        const council = await getCouncilForCatalog(catalogId);
        await assertCouncilEvaluationsComplete(council.id);

        const data = await buildMinutesPdfData(catalogId, council.id);
        const result = await exportEditableDocumentPdf(
            profile,
            catalogId,
            "minutes-council",
            `bien-ban-hop-hoi-dong-${data.catalog.code}.pdf`,
            DisposalAppraisalDocumentType.MINUTES_COUNCIL,
        );
        await maybeLockCouncilVoting(catalogId, council.id);
        return result;
    },

    async exportMinutesDestruction(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        await assertAppraisalExportAllowed(catalogId);
        const council = await getCouncilForCatalog(catalogId);
        await assertCouncilEvaluationsComplete(council.id);

        const data = await buildMinutesPdfData(catalogId, council.id);
        const result = await exportEditableDocumentPdf(
            profile,
            catalogId,
            "minutes-destruction",
            `bien-ban-huy-ho-so-${data.catalog.code}.pdf`,
            DisposalAppraisalDocumentType.MINUTES_DESTRUCTION,
        );
        await maybeLockCouncilVoting(catalogId, council.id);
        return result;
    },

    async uploadSignedMinutesPair(
        profile: UserWithRoles,
        catalogId: string,
        councilMinutesFile: File,
        destructionMinutesFile: File,
    ) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        await getCouncilForCatalog(catalogId);

        if (councilMinutesFile.type !== "application/pdf" ||
            destructionMinutesFile.type !== "application/pdf") {
            throw httpError.badRequest("Biên bản ký phải là file PDF");
        }

        const [catalog] = await db.select({
            status: disposalProposalCatalogs.status,
        })
            .from(disposalProposalCatalogs)
            .where(eq(disposalProposalCatalogs.id, catalogId))
            .limit(1);
        if (!catalog) throw httpError.notFound("Không tìm thấy danh mục");
        if (
            catalog.status !== DisposalProposalCatalogStatus.PENDING_SUBMIT &&
            catalog.status !== DisposalProposalCatalogStatus.AWAITING_FEEDBACK
        ) {
            throw httpError.conflict(
                "Chỉ tải biên bản đã ký khi danh mục đang Chờ thẩm tra hoặc đã gửi thẩm định",
            );
        }

        const councilBytes = new Uint8Array(await councilMinutesFile.arrayBuffer());
        const destructionBytes = new Uint8Array(await destructionMinutesFile.arrayBuffer());
        const now = new Date();
        const councilKey = normalizeStorageKey(
            `archive-disposal/catalogs/${catalogId}/appraisal/signed-council-${now.getTime()}.pdf`,
        );
        const destructionKey = normalizeStorageKey(
            `archive-disposal/catalogs/${catalogId}/appraisal/signed-destruction-${now.getTime()}.pdf`,
        );

        await uploadSignedPdfToStorage(councilKey, councilBytes);
        await uploadSignedPdfToStorage(destructionKey, destructionBytes);

        for (const [documentType, storageKey] of [
            [DisposalAppraisalDocumentType.MINUTES_COUNCIL, councilKey],
            [DisposalAppraisalDocumentType.MINUTES_DESTRUCTION, destructionKey],
        ] as const) {
            await db.insert(disposalAppraisalDocuments).values({
                catalogId,
                documentType,
                signedStorageKey: storageKey,
                signedUploadedAt: now,
                signedUploadedBy: profile.id,
                updatedAt: now,
            }).onConflictDoUpdate({
                target: [
                    disposalAppraisalDocuments.catalogId,
                    disposalAppraisalDocuments.documentType,
                ],
                set: {
                    signedStorageKey: storageKey,
                    signedUploadedAt: now,
                    signedUploadedBy: profile.id,
                    updatedAt: now,
                },
            });
        }

        if (catalog.status === DisposalProposalCatalogStatus.PENDING_SUBMIT) {
            await db.update(disposalProposalCatalogs)
                .set({
                    status: DisposalProposalCatalogStatus.AWAITING_FEEDBACK,
                    appraisalSubmittedAt: now,
                    updatedAt: now,
                })
                .where(eq(disposalProposalCatalogs.id, catalogId));
        }

        logActivity({
            userId: profile.id,
            module: "archive-disposal",
            eventType: "disposal.appraisal.signed_minutes_uploaded",
            summary: catalog.status === DisposalProposalCatalogStatus.PENDING_SUBMIT
                ? "Tải lên 2 biên bản đã ký — danh mục chuyển sang Đã gửi thẩm định, chờ phản hồi"
                : "Tải lên 2 biên bản đã ký cho bộ hồ sơ thẩm định",
            entityType: "disposal_proposal_catalog",
            entityId: catalogId,
        });

        return this.getAppraisalDocuments(profile, catalogId);
    },

    async downloadDocument(
        profile: UserWithRoles,
        catalogId: string,
        documentType: DisposalAppraisalDocumentTypeType,
        variant: "draft" | "signed",
    ) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const [row] = await db.select()
            .from(disposalAppraisalDocuments)
            .where(and(
                eq(disposalAppraisalDocuments.catalogId, catalogId),
                eq(disposalAppraisalDocuments.documentType, documentType),
            ))
            .limit(1);
        if (!row) throw httpError.notFound("Chưa có file kết xuất");

        const key = variant === "signed" ? row.signedStorageKey : row.draftStorageKey;
        if (!key) {
            throw httpError.notFound(variant === "signed" ? "Chưa có bản ký" : "Chưa xuất file");
        }

        const url = await buildLinkGet(key, { expirySeconds: 86_400 });
        return { url, storageKey: key };
    },

    async markAppraisalSubmitted(profile: UserWithRoles, catalogId: string) {
        await assertCanAccessDisposalCatalog(profile, catalogId);
        const status = await this.getAppraisalDocuments(profile, catalogId);
        if (!status.readyToSubmit) {
            throw httpError.conflict(
                `Chưa đủ thành phần: ${status.missingComponents.join(", ") || "thiếu file"}`,
            );
        }
        const now = new Date();
        await db.update(disposalProposalCatalogs)
            .set({
                appraisalSubmittedAt: now,
                status: DisposalProposalCatalogStatus.AWAITING_FEEDBACK,
                updatedAt: now,
            })
            .where(eq(disposalProposalCatalogs.id, catalogId));
        return { appraisalSubmittedAt: now.toISOString() };
    },
};
