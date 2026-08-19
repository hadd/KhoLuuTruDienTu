import { Elysia, t } from "elysia";

import { httpError } from "@shared/common-lib";

import { plugins } from "../../libs/plugins/_index.ts";

import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";

import {

    hasArchiveDisposalCreatePermission,

    hasArchiveDisposalReadPermission,

    hasArchiveDisposalSubmitPermission,

    hasArchiveDisposalUpdatePermission,

    hasArchiveDisposalCouncilCreatePermission,

    hasArchiveDisposalCouncilReadPermission,

    hasArchiveDisposalCouncilUpdatePermission,

    hasArchiveDisposalCouncilFinalizePermission,

    hasArchiveDisposalCouncilPublishPermission,

    hasArchiveDisposalCouncilChairDecidePermission,

    hasArchiveDisposalDestroyPermission,

    hasArchiveDisposalSettingsReadPermission,

    hasArchiveDisposalSettingsUpdatePermission,

} from "./archive-disposal-permissions.ts";

import {
    assertCanAccessDisposalCatalog,
    resolveDisposalCatalogListScope,
} from "./archive-disposal-catalog-access.ts";

import { ArchiveDisposalService } from "./archive-disposal-service.ts";
import { DisposalCouncilService } from "./disposal-council-service.ts";
import { DisposalAppendixExportService } from "./disposal-appendix-export-service.ts";
import { DisposalAppraisalExportService } from "./disposal-appraisal-export-service.ts";
import { DisposalDocumentDraftService } from "./disposal-document-draft-service.ts";
import { assertDisposalCatalogCreator } from "./disposal-council-role-guards.ts";



const tags = ["Archive Disposal"];



function checkRead(profile: UserWithRoles) {

    if (!hasArchiveDisposalReadPermission(profile)) {

        throw httpError.forbidden("archive.disposal.read required");

    }

}



function checkCreate(profile: UserWithRoles) {

    if (!hasArchiveDisposalCreatePermission(profile)) {

        throw httpError.forbidden("archive.disposal.create required");

    }

}



function checkUpdate(profile: UserWithRoles) {

    if (!hasArchiveDisposalUpdatePermission(profile)) {

        throw httpError.forbidden("archive.disposal.update required");

    }

}



function checkSubmit(profile: UserWithRoles) {

    if (!hasArchiveDisposalSubmitPermission(profile)) {

        throw httpError.forbidden("archive.disposal.submit required");

    }

}



function checkCouncilRead(profile: UserWithRoles) {

    if (!hasArchiveDisposalCouncilReadPermission(profile)) {

        throw httpError.forbidden("archive.disposal.council.read required");

    }

}



function checkCouncilCreate(profile: UserWithRoles) {

    if (!hasArchiveDisposalCouncilCreatePermission(profile)) {

        throw httpError.forbidden("archive.disposal.council.create required");

    }

}



function checkCouncilUpdate(profile: UserWithRoles) {

    if (!hasArchiveDisposalCouncilUpdatePermission(profile)) {

        throw httpError.forbidden("archive.disposal.council.update required");

    }

}



function checkCouncilFinalize(profile: UserWithRoles) {

    if (!hasArchiveDisposalCouncilFinalizePermission(profile)) {

        throw httpError.forbidden("archive.disposal.council.finalize required");

    }

}



function checkCouncilPublish(profile: UserWithRoles) {

    if (!hasArchiveDisposalCouncilPublishPermission(profile)) {

        throw httpError.forbidden("archive.disposal.council.publish required");

    }

}

/** Người lập danh mục có quyền gửi danh mục cũng được xuất Quyết định / biên bản. */
async function checkCouncilPublishForCouncil(
    profile: UserWithRoles,
    councilId: string,
) {
    if (hasArchiveDisposalCouncilPublishPermission(profile)) return;
    await assertDisposalCatalogCreator(councilId, profile.id);
    if (!hasArchiveDisposalSubmitPermission(profile)) {
        throw httpError.forbidden("archive.disposal.council.publish required");
    }
}



function checkCouncilChairDecide(profile: UserWithRoles) {

    if (!hasArchiveDisposalCouncilChairDecidePermission(profile)) {

        throw httpError.forbidden("archive.disposal.council.chair_decide required");

    }

}



function checkSettingsRead(profile: UserWithRoles) {

    if (!hasArchiveDisposalSettingsReadPermission(profile)) {

        throw httpError.forbidden("archive.disposal.settings.read required");

    }

}



function checkSettingsUpdate(profile: UserWithRoles) {

    if (!hasArchiveDisposalSettingsUpdatePermission(profile)) {

        throw httpError.forbidden("archive.disposal.settings.update required");

    }

}



function checkDestroy(profile: UserWithRoles) {

    if (!hasArchiveDisposalDestroyPermission(profile)) {

        throw httpError.forbidden("archive.disposal.destroy required");

    }

}



async function assertCouncilCatalogAccess(
    profile: UserWithRoles,
    councilId: string,
) {
    const detail = await DisposalCouncilService.getCouncil(councilId);
    await assertCanAccessDisposalCatalog(profile, detail.council.catalogId);
    return detail;
}



const councilMemberSchema = t.Object({

    userId: t.String({ format: "uuid" }),

    positionRole: t.String({ minLength: 1 }),

    representationType: t.Union([
        t.Literal("LEADERSHIP"),
        t.Literal("ARCHIVE_DEPT"),
        t.Literal("SPECIALIST_DEPT"),
        t.Literal("OTHER"),
    ]),

    sortOrder: t.Optional(t.Numeric()),

});



const candidateCategorySchema = t.Union([

    t.Literal("all"),

    t.Literal("expiring_soon"),

    t.Literal("expired"),

    t.Literal("duplicate"),

]);



const itemSourceSchema = t.Union([

    t.Literal("EXPIRED"),

    t.Literal("EXPIRING_SOON"),

    t.Literal("DUPLICATE"),

    t.Literal("WAREHOUSE"),

]);

const pl3ContentSchema = t.Object({
    creatingAgency: t.String(),
    formationMission: t.String(),
    collectionSource: t.String(),
    timePeriod: t.String(),
    expiryDuplicateReason: t.String(),
    priorValuation: t.String(),
    countsDetail: t.String(),
    timeRangeText: t.String(),
    expiredGroupSummary: t.String(),
    duplicateGroupSummary: t.String(),
    otherGroupSummary: t.String(),
});

const appraisalDocumentTypeSchema = t.Union([
    t.Literal("PL2"),
    t.Literal("PL3"),
    t.Literal("MINUTES_COUNCIL"),
    t.Literal("MINUTES_DESTRUCTION"),
]);

const editableDocumentSlugSchema = t.Union([
    t.Literal("pl3"),
    t.Literal("minutes-council"),
    t.Literal("minutes-destruction"),
]);

const tipTapDocumentSchema = t.Object({
    type: t.Literal("doc"),
    content: t.Array(t.Any()),
});

function appraisalFileResponse(
    result: { body: Uint8Array; contentType: string; filename: string },
) {
    const safeName = result.filename.replace(/[\r\n"]+/g, "_").trim();
    return new Response(Buffer.from(result.body), {
        headers: {
            "Content-Type": result.contentType,
            "Content-Disposition": `attachment; filename="${safeName}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}


export function createArchiveDisposalRouter(basePath: string = "/archive-disposal") {

    return new Elysia({ name: "archiveDisposalRouter", prefix: basePath })

        .use(plugins.urlQuery)

        .use(plugins.authProfile)

        .get(

            "/candidates",

            async ({ profile, urlQuery }) => {

                checkRead(profile);

                return await ArchiveDisposalService.listCandidates(profile, {

                    category: urlQuery.category,

                    entityKind: urlQuery.entityKind,

                    fondId: urlQuery.fondId,

                    dossierTypeId: urlQuery.dossierTypeId,

                    documentTypeId: urlQuery.documentTypeId,

                    inventoryId: urlQuery.inventoryId,

                    retentionPeriodId: urlQuery.retentionPeriodId,

                    physicalItemId: urlQuery.physicalItemId,

                    dateFrom: urlQuery.dateFrom,

                    dateTo: urlQuery.dateTo,

                    search: urlQuery.search,

                    page: urlQuery.page,

                    limit: urlQuery.limit,

                    includeInCatalog: urlQuery.includeInCatalog,

                });

            },

            {

                query: t.Object({

                    category: t.Optional(candidateCategorySchema),

                    entityKind: t.Optional(t.Union([
                        t.Literal("dossier"),
                        t.Literal("document"),
                        t.Literal("grouped"),
                    ])),

                    fondId: t.Optional(t.String()),

                    dossierTypeId: t.Optional(t.String()),

                    documentTypeId: t.Optional(t.String()),

                    inventoryId: t.Optional(t.String()),

                    retentionPeriodId: t.Optional(t.String()),

                    physicalItemId: t.Optional(t.String()),

                    dateFrom: t.Optional(t.String()),

                    dateTo: t.Optional(t.String()),

                    search: t.Optional(t.String()),

                    page: t.Optional(t.Numeric()),

                    limit: t.Optional(t.Numeric()),

                    includeInCatalog: t.Optional(t.Boolean()),

                }),

                detail: { tags, summary: "Danh sách hồ sơ hết hạn / sắp hết hạn / trùng lặp" },

            },

        )

        .get(

            "/catalogs",

            async ({ profile, urlQuery }) => {

                const scope = await resolveDisposalCatalogListScope(profile);

                return await ArchiveDisposalService.listCatalogs(profile, {

                    page: urlQuery.page,

                    limit: urlQuery.limit,

                }, scope);

            },

            {

                query: t.Object({

                    page: t.Optional(t.Numeric()),

                    limit: t.Optional(t.Numeric()),

                }),

                detail: { tags, summary: "Danh sách danh mục đề xuất hủy" },

            },

        )

        .get(

            "/catalogs/:catalogId",

            async ({ profile, params }) => {

                return await ArchiveDisposalService.getCatalog(profile, params.catalogId);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Chi tiết danh mục đề xuất hủy" },

            },

        )

        .post(

            "/catalogs",

            async ({ profile, body }) => {

                checkCreate(profile);

                const created = await ArchiveDisposalService.createCatalog(profile, body);

                return created;

            },

            {

                body: t.Object({

                    name: t.String({ minLength: 1 }),

                    catalogDate: t.String({ minLength: 1 }),

                    notes: t.Optional(t.String()),

                }),

                detail: { tags, summary: "Tạo danh mục đề xuất hủy" },

            },

        )

        .patch(

            "/catalogs/:catalogId",

            async ({ profile, params, body }) => {

                checkUpdate(profile);

                return await ArchiveDisposalService.updateCatalog(

                    profile,

                    params.catalogId,

                    body,

                );

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                body: t.Object({

                    name: t.Optional(t.String({ minLength: 1 })),

                    catalogDate: t.Optional(t.String()),

                    notes: t.Optional(t.Union([t.String(), t.Null()])),

                }),

                detail: { tags, summary: "Cập nhật danh mục đề xuất hủy" },

            },

        )

        .delete(

            "/catalogs/:catalogId",

            async ({ profile, params }) => {

                checkUpdate(profile);

                await ArchiveDisposalService.deleteCatalog(profile, params.catalogId);

                return { ok: true };

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Xóa danh mục đề xuất hủy" },

            },

        )

        .post(

            "/catalogs/:catalogId/items",

            async ({ profile, params, body }) => {

                checkUpdate(profile);

                return await ArchiveDisposalService.upsertCatalogItem(params.catalogId, body);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                body: t.Object({

                    dossierId: t.String({ format: "uuid" }),

                    fileId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),

                    source: itemSourceSchema,

                    reason: t.Optional(t.String()),

                    notes: t.Optional(t.String()),

                }),

                detail: { tags, summary: "Thêm hồ sơ vào danh mục" },

            },

        )

        .patch(

            "/catalogs/:catalogId/items/:itemId",

            async ({ profile, params, body }) => {

                checkUpdate(profile);

                return await ArchiveDisposalService.updateCatalogItem(

                    params.catalogId,

                    params.itemId,

                    body,

                );

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    itemId: t.String({ format: "uuid" }),

                }),

                body: t.Object({

                    reason: t.Optional(t.String()),

                    notes: t.Optional(t.Union([t.String(), t.Null()])),

                }),

                detail: { tags, summary: "Cập nhật lý do hủy cho hồ sơ trong danh mục" },

            },

        )

        .delete(

            "/catalogs/:catalogId/items/:itemId",

            async ({ profile, params }) => {

                checkUpdate(profile);

                await ArchiveDisposalService.removeCatalogItem(

                    params.catalogId,

                    params.itemId,

                );

                return { ok: true };

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    itemId: t.String({ format: "uuid" }),

                }),

                detail: { tags, summary: "Xóa hồ sơ khỏi danh mục" },

            },

        )

        .get(

            "/catalogs/:catalogId/export/phu-luc-ii",

            async ({ profile, params }) => {

                checkRead(profile);

                const result = await DisposalAppendixExportService.exportPhuLucII(

                    profile,

                    params.catalogId,

                );

                const safeName = result.filename.replace(/[\r\n"]+/g, "_").trim();

                return new Response(Buffer.from(result.body), {

                    headers: {

                        "Content-Type": result.contentType,

                        "Content-Disposition": `attachment; filename="${safeName}"`,

                        "Cache-Control": "private, no-store",

                        "X-Content-Type-Options": "nosniff",

                    },

                });

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Xuất PDF Phụ lục II — Danh mục tài liệu hết hạn/trùng lặp" },

            },

        )

        .get(

            "/catalogs/:catalogId/appendix-iii/suggestions",

            async ({ profile, params }) => {

                checkRead(profile);

                return await DisposalAppendixExportService.getPl3Suggestions(

                    profile,

                    params.catalogId,

                );

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Gợi ý nội dung Phụ lục III — Bản thuyết minh" },

            },

        )

        .post(

            "/catalogs/:catalogId/export/phu-luc-iii",

            async ({ profile, params, body }) => {

                checkRead(profile);

                const result = await DisposalAppendixExportService.exportPhuLucIII(

                    profile,

                    params.catalogId,

                    body,

                );

                const safeName = result.filename.replace(/[\r\n"]+/g, "_").trim();

                return new Response(Buffer.from(result.body), {

                    headers: {

                        "Content-Type": result.contentType,

                        "Content-Disposition": `attachment; filename="${safeName}"`,

                        "Cache-Control": "private, no-store",

                        "X-Content-Type-Options": "nosniff",

                    },

                });

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                body: pl3ContentSchema,

                detail: { tags, summary: "Xuất PDF Phụ lục III — Bản thuyết minh (nội dung form)" },

            },

        )

        .get(

            "/catalogs/:catalogId/appraisal-documents",

            async ({ profile, params }) => {

                checkRead(profile);

                return await DisposalAppraisalExportService.getAppraisalDocuments(

                    profile,

                    params.catalogId,

                );

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Trạng thái bộ hồ sơ đề nghị thẩm định (4 file)" },

            },

        )

        .get(

            "/catalogs/:catalogId/appraisal-documents/pl3/content",

            async ({ profile, params }) => {

                checkRead(profile);

                const content = await DisposalAppraisalExportService.getPl3Content(

                    profile,

                    params.catalogId,

                );

                return { content };

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Nội dung Phụ lục III đã lưu trên server" },

            },

        )

        .put(

            "/catalogs/:catalogId/appraisal-documents/pl3/content",

            async ({ profile, params, body }) => {

                checkRead(profile);

                await DisposalAppraisalExportService.savePl3Content(

                    profile,

                    params.catalogId,

                    body,

                );

                return { ok: true };

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                body: pl3ContentSchema,

                detail: { tags, summary: "Lưu nội dung Phụ lục III" },

            },

        )

        .get(

            "/catalogs/:catalogId/appraisal-documents/drafts/:slug",

            async ({ profile, params }) => {

                checkRead(profile);

                return await DisposalDocumentDraftService.getDraft(

                    profile,

                    params.catalogId,

                    params.slug,

                );

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    slug: editableDocumentSlugSchema,

                }),

                detail: { tags, summary: "Lấy bản nháp TipTap (PL III / biên bản)" },

            },

        )

        .put(

            "/catalogs/:catalogId/appraisal-documents/drafts/:slug",

            async ({ profile, params, body }) => {

                checkRead(profile);

                await DisposalDocumentDraftService.saveDraftContent(

                    profile,

                    params.catalogId,

                    params.slug,

                    body,

                );

                return { ok: true };

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    slug: editableDocumentSlugSchema,

                }),

                body: tipTapDocumentSchema,

                detail: { tags, summary: "Lưu bản nháp TipTap" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/drafts/:slug/regenerate",

            async ({ profile, params }) => {

                checkRead(profile);

                return await DisposalDocumentDraftService.regenerateDraft(

                    profile,

                    params.catalogId,

                    params.slug,

                );

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    slug: editableDocumentSlugSchema,

                }),

                detail: { tags, summary: "Tạo lại bản nháp từ dữ liệu Hội đồng" },

            },

        )

        .get(

            "/catalogs/:catalogId/appraisal-documents/drafts/:slug/docx",

            async ({ profile, params }) => {

                checkRead(profile);

                const result = await DisposalDocumentDraftService.downloadDraftDocx(

                    profile,

                    params.catalogId,

                    params.slug,

                );

                const safeName = result.filename.replace(/[\r\n"]+/g, "_").trim();

                return new Response(Buffer.from(result.body), {

                    headers: {

                        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

                        "Content-Disposition": `attachment; filename="${safeName}"`,

                        "Cache-Control": "private, no-store",

                        "X-Content-Type-Options": "nosniff",

                    },

                });

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    slug: editableDocumentSlugSchema,

                }),

                detail: { tags, summary: "Tải DOCX mẫu đã điền" },

            },

        )

        .put(

            "/catalogs/:catalogId/appraisal-documents/drafts/:slug/docx",

            async ({ profile, params, body }) => {

                checkRead(profile);

                const file = body.file as File | undefined;

                if (!file) throw httpError.badRequest("Cần tải lên file DOCX");

                await DisposalDocumentDraftService.uploadDraftDocx(

                    profile,

                    params.catalogId,

                    params.slug,

                    file,

                );

                return { ok: true };

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    slug: editableDocumentSlugSchema,

                }),

                body: t.Object({ file: t.File() }),

                detail: { tags, summary: "Tải lên DOCX đã sửa bằng Word" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/pl2/export",

            async ({ profile, params }) => {

                checkRead(profile);

                const result = await DisposalAppraisalExportService.exportPl2(

                    profile,

                    params.catalogId,

                );

                return appraisalFileResponse(result);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Xuất Phụ lục II vào bộ thẩm định" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/pl3/export",

            async ({ profile, params, body }) => {

                checkRead(profile);

                const result = await DisposalAppraisalExportService.exportPl3(

                    profile,

                    params.catalogId,

                    body,

                );

                return appraisalFileResponse(result);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                body: t.Optional(pl3ContentSchema),

                detail: { tags, summary: "Xuất Phụ lục III vào bộ thẩm định" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/minutes-council/export",

            async ({ profile, params }) => {

                checkRead(profile);

                const result = await DisposalAppraisalExportService.exportMinutesCouncil(

                    profile,

                    params.catalogId,

                );

                return appraisalFileResponse(result);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Xuất biên bản Họp Hội đồng xét hủy" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/minutes-destruction/export",

            async ({ profile, params }) => {

                checkRead(profile);

                const result = await DisposalAppraisalExportService.exportMinutesDestruction(

                    profile,

                    params.catalogId,

                );

                return appraisalFileResponse(result);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Xuất biên bản Về việc hủy hồ sơ hết giá trị" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/signed-minutes",

            async ({ profile, params, body }) => {

                checkRead(profile);

                const councilMinutes = body.councilMinutes as File | undefined;

                const destructionMinutes = body.destructionMinutes as File | undefined;

                if (!councilMinutes || !destructionMinutes) {

                    throw httpError.badRequest("Cần tải lên đủ 2 biên bản đã ký (PDF)");

                }

                return await DisposalAppraisalExportService.uploadSignedMinutesPair(

                    profile,

                    params.catalogId,

                    councilMinutes,

                    destructionMinutes,

                );

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                body: t.Object({

                    councilMinutes: t.File(),

                    destructionMinutes: t.File(),

                }),

                detail: { tags, summary: "Tải lên 2 biên bản đã ký (bắt buộc đủ cả hai)" },

            },

        )

        .get(

            "/catalogs/:catalogId/appraisal-documents/:documentType/download",

            async ({ profile, params, query }) => {

                checkRead(profile);

                const variant = query.variant === "signed" ? "signed" : "draft";

                return await DisposalAppraisalExportService.downloadDocument(

                    profile,

                    params.catalogId,

                    params.documentType,

                    variant,

                );

            },

            {

                params: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    documentType: appraisalDocumentTypeSchema,

                }),

                query: t.Object({ variant: t.Optional(t.Union([t.Literal("draft"), t.Literal("signed")])) }),

                detail: { tags, summary: "Liên kết tải file trong bộ thẩm định" },

            },

        )

        .post(

            "/catalogs/:catalogId/appraisal-documents/submit",

            async ({ profile, params }) => {

                checkSubmit(profile);

                return await DisposalAppraisalExportService.markAppraisalSubmitted(

                    profile,

                    params.catalogId,

                );

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Đánh dấu đã gửi thẩm định (sẵn sàng gửi)" },

            },

        )

        .post(

            "/catalogs/:catalogId/submit",

            async ({ profile, params }) => {

                checkSubmit(profile);

                return await ArchiveDisposalService.submitCatalog(profile, params.catalogId);

            },

            {

                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Trình duyệt danh mục đề xuất hủy" },

            },

        )

        .post(

            "/transfer-to-proposal",

            async ({ profile, body }) => {

                if (body.catalogId) {

                    checkUpdate(profile);

                } else {

                    checkCreate(profile);

                }

                return await ArchiveDisposalService.transferToProposal(profile, body);

            },

            {

                body: t.Object({

                    catalogId: t.Optional(t.String({ format: "uuid" })),

                    name: t.Optional(t.String()),

                    catalogDate: t.Optional(t.String()),

                    items: t.Array(t.Object({

                        dossierId: t.String({ format: "uuid" }),

                        fileId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),

                        source: itemSourceSchema,

                    }), { minItems: 1 }),

                }),

                detail: { tags, summary: "Chuyển hồ sơ đã chọn sang đề xuất hủy" },

            },

        )

        .get(

            "/settings",

            async ({ profile }) => {

                checkSettingsRead(profile);

                return await DisposalCouncilService.getSettings();

            },

            {

                detail: { tags, summary: "Đọc cấu hình quy trình xét hủy" },

            },

        )

        .patch(

            "/settings",

            async ({ profile, body }) => {

                checkSettingsUpdate(profile);

                return await DisposalCouncilService.updateSettings(

                    profile,

                    body.councilReviewEnabled,

                );

            },

            {

                body: t.Object({

                    councilReviewEnabled: t.Boolean(),

                }),

                detail: { tags, summary: "Cập nhật cấu hình quy trình xét hủy" },

            },

        )

        .get(

            "/councils",

            async ({ profile, urlQuery }) => {

                const scope = await resolveDisposalCatalogListScope(profile);

                if (urlQuery.catalogId) {
                    await assertCanAccessDisposalCatalog(profile, urlQuery.catalogId);
                }

                return await DisposalCouncilService.listCouncils(profile, {

                    page: urlQuery.page,

                    limit: urlQuery.limit,

                    catalogId: urlQuery.catalogId,

                }, scope);

            },

            {

                query: t.Object({

                    page: t.Optional(t.Numeric()),

                    limit: t.Optional(t.Numeric()),

                    catalogId: t.Optional(t.String({ format: "uuid" })),

                }),

                detail: { tags, summary: "Danh sách Hội đồng xét hủy" },

            },

        )

        .get(

            "/councils/:councilId",

            async ({ profile, params }) => {

                await assertCouncilCatalogAccess(profile, params.councilId);

                return await DisposalCouncilService.getCouncil(params.councilId);

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Chi tiết Hội đồng xét hủy" },

            },

        )

        .get(

            "/councils/:councilId/history",

            async ({ profile, params }) => {

                checkCouncilRead(profile);

                return await DisposalCouncilService.getCouncilHistory(params.councilId);

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Lịch sử thay đổi thành viên Hội đồng" },

            },

        )

        .get(

            "/catalogs/available-for-council",

            async ({ profile }) => {

                checkCouncilRead(profile);

                return await DisposalCouncilService.listAvailableCatalogsForCouncil();

            },

            {

                detail: { tags, summary: "Danh mục khả dụng để gắn Hội đồng" },

            },

        )

        .post(

            "/councils",

            async ({ profile, body }) => {

                checkCouncilCreate(profile);

                return await DisposalCouncilService.createCouncil(profile, body);

            },

            {

                body: t.Object({

                    catalogId: t.String({ format: "uuid" }),

                    members: t.Array(councilMemberSchema, { minItems: 1 }),

                    copiedFromCouncilId: t.Optional(t.Union([
                        t.String({ format: "uuid" }),
                        t.Null(),
                    ])),

                }),

                detail: { tags, summary: "Tạo Hội đồng xét hủy" },

            },

        )

        .post(

            "/councils/:councilId/copy-members",

            async ({ profile, params, body }) => {

                checkCouncilCreate(profile);

                return await DisposalCouncilService.copyCouncilMembers(profile, {

                    targetCatalogId: body.targetCatalogId,

                    sourceCouncilId: params.councilId,

                    members: body.members,

                });

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                body: t.Object({

                    targetCatalogId: t.String({ format: "uuid" }),

                    members: t.Optional(t.Array(councilMemberSchema)),

                }),

                detail: { tags, summary: "Sao chép thành viên từ Hội đồng cũ" },

            },

        )

        .patch(

            "/councils/:councilId/members",

            async ({ profile, params, body }) => {

                checkCouncilUpdate(profile);

                return await DisposalCouncilService.updateCouncilMembers(

                    profile,

                    params.councilId,

                    body,

                );

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                body: t.Object({

                    members: t.Array(councilMemberSchema),

                    reason: t.Optional(t.String()),

                }),

                detail: { tags, summary: "Cập nhật thành viên Hội đồng" },

            },

        )

        .get(

            "/councils/:councilId/evaluations",

            async ({ profile, params }) => {

                await assertCouncilCatalogAccess(profile, params.councilId);

                return await DisposalCouncilService.listCouncilEvaluations(params.councilId);

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Danh sách ý kiến đánh giá Hội đồng theo hồ sơ" },

            },

        )

        .put(

            "/councils/:councilId/items/:itemId/evaluation",

            async ({ profile, params, body }) => {

                await assertCouncilCatalogAccess(profile, params.councilId);

                return await DisposalCouncilService.upsertCouncilItemEvaluation(

                    profile,

                    params.councilId,

                    params.itemId,

                    {

                        decision: body.decision,

                        reason: body.reason,

                        changeReason: body.changeReason,

                    },

                );

            },

            {

                params: t.Object({

                    councilId: t.String({ format: "uuid" }),

                    itemId: t.String({ format: "uuid" }),

                }),

                body: t.Object({

                    decision: t.Union([t.Literal("DESTROY"), t.Literal("KEEP")]),

                    reason: t.String({ minLength: 1 }),

                    changeReason: t.Optional(t.String()),

                }),

                detail: { tags, summary: "Ghi phiếu đánh giá của thành viên Hội đồng" },

            },

        )

        .patch(

            "/councils/:councilId/members/:userId/absence",

            async ({ profile, params, body }) => {

                checkCouncilUpdate(profile);

                return await DisposalCouncilService.setCouncilMemberAbsent(

                    profile,

                    params.councilId,

                    params.userId,

                    body,

                );

            },

            {

                params: t.Object({

                    councilId: t.String({ format: "uuid" }),

                    userId: t.String({ format: "uuid" }),

                }),

                body: t.Object({

                    excusedAbsent: t.Boolean(),

                    absentReason: t.Optional(t.String()),

                }),

                detail: { tags, summary: "Đánh dấu vắng mặt có lý do cho thành viên Hội đồng" },

            },

        )

        .post(

            "/councils/:councilId/items/:itemId/chair-decision",

            async ({ profile, params, body }) => {

                checkCouncilChairDecide(profile);

                await assertCouncilCatalogAccess(profile, params.councilId);

                return await DisposalCouncilService.chairDecideCouncilItem(

                    profile,

                    params.councilId,

                    params.itemId,

                    body,

                );

            },

            {

                params: t.Object({

                    councilId: t.String({ format: "uuid" }),

                    itemId: t.String({ format: "uuid" }),

                }),

                body: t.Object({

                    decision: t.Union([t.Literal("DESTROY"), t.Literal("KEEP")]),

                    reason: t.String({ minLength: 1 }),

                }),

                detail: { tags, summary: "Chủ tịch quyết định khi hòa phiếu" },

            },

        )

        .post(

            "/councils/:councilId/publish-decision",

            async ({ profile, params }) => {

                await checkCouncilPublishForCouncil(profile, params.councilId);

                await assertCouncilCatalogAccess(profile, params.councilId);

                return await DisposalCouncilService.publishCouncilDecision(

                    profile,

                    params.councilId,

                );

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Xuất bản Quyết định Hội đồng (PDF) và khóa đánh giá" },

            },

        )

        .get(

            "/councils/:councilId/decision-documents",

            async ({ profile, params }) => {

                await assertCouncilCatalogAccess(profile, params.councilId);

                return await DisposalCouncilService.getCouncilDecisionDocuments(params.councilId);

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                detail: { tags, summary: "Liên kết tải Quyết định và biên bản ký Hội đồng" },

            },

        )

        .post(

            "/councils/:councilId/signed-minutes",

            async ({ profile, params, body }) => {

                await checkCouncilPublishForCouncil(profile, params.councilId);

                await assertCouncilCatalogAccess(profile, params.councilId);

                const file = body.file as File | undefined;

                if (!file) {

                    throw httpError.badRequest("Chưa chọn file biên bản");

                }

                return await DisposalCouncilService.uploadCouncilSignedMinutes(

                    profile,

                    params.councilId,

                    file,

                );

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                body: t.Object({ file: t.File() }),

                detail: { tags, summary: "Tải lên biên bản Hội đồng đã ký (PDF)" },

            },

        )

        .post(

            "/councils/:councilId/finalize",

            async ({ profile, params, body }) => {

                checkCouncilFinalize(profile);

                return await DisposalCouncilService.finalizeCouncilReviewWithAuth(

                    profile,

                    params.councilId,

                    body.result,

                );

            },

            {

                params: t.Object({ councilId: t.String({ format: "uuid" }) }),

                body: t.Object({

                    result: t.Union([t.Literal("APPROVED"), t.Literal("REJECTED")]),

                }),

                detail: { tags, summary: "Kết luận thẩm tra Hội đồng xét hủy" },

            },

        )
        .post(
            "/catalogs/:catalogId/execute-destroy",
            async ({ profile, params }) => {
                checkDestroy(profile);
                return await DisposalCouncilService.executeDirectDestroy(
                    profile,
                    params.catalogId,
                );
            },
            {
                params: t.Object({ catalogId: t.String({ format: "uuid" }) }),
                detail: { tags, summary: "Thực hiện hủy trực tiếp danh mục" },
            },
        )
        .post(
            "/candidates/execute-destroy",
            async ({ profile, body }) => {
                checkDestroy(profile);
                await ArchiveDisposalService.executeDirectDestroyCandidates(
                    profile,
                    body.candidateKeys,
                );
                return { success: true };
            },
            {
                body: t.Object({
                    candidateKeys: t.Array(t.String()),
                }),
                detail: { tags, summary: "Thực hiện hủy trực tiếp danh sách ứng viên (bỏ qua TT06)" },
            },
        );
}

