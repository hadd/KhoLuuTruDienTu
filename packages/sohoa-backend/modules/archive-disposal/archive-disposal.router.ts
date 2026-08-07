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

    hasArchiveDisposalDestroyPermission,

    hasArchiveDisposalSettingsReadPermission,

    hasArchiveDisposalSettingsUpdatePermission,

} from "./archive-disposal-permissions.ts";

import { ArchiveDisposalService } from "./archive-disposal-service.ts";
import { DisposalCouncilService } from "./disposal-council-service.ts";



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

                checkRead(profile);

                return await ArchiveDisposalService.listCatalogs(profile, {

                    page: urlQuery.page,

                    limit: urlQuery.limit,

                });

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

                checkRead(profile);

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

                if (urlQuery.catalogId) {
                    checkRead(profile);
                } else {
                    checkCouncilRead(profile);
                }

                return await DisposalCouncilService.listCouncils({

                    page: urlQuery.page,

                    limit: urlQuery.limit,

                    catalogId: urlQuery.catalogId,

                });

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

                checkRead(profile);

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

                checkRead(profile);

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

                checkRead(profile);

                return await DisposalCouncilService.upsertCouncilItemEvaluation(

                    profile,

                    params.councilId,

                    params.itemId,

                    body.note,

                );

            },

            {

                params: t.Object({

                    councilId: t.String({ format: "uuid" }),

                    itemId: t.String({ format: "uuid" }),

                }),

                body: t.Object({ note: t.String({ minLength: 1 }) }),

                detail: { tags, summary: "Ghi ý kiến đánh giá của thành viên Hội đồng" },

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

        );

}

