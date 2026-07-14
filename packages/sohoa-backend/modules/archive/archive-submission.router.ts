import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ArchiveSubmissionService } from "./archive-submission-service.ts";
import { ItemService, LevelService } from "../physical-warehouse/physical-warehouse-service.ts";
import { PlacementService } from "../physical-warehouse/physical-placement-service.ts";

const tags = ["Archive Submission"];

const fieldValuesSchema = t.Record(t.String(), t.Unknown());

export function createArchiveSubmissionRouter(basePath: string = "/archive-submissions") {
    const app = new Elysia({
        name: "archiveSubmissionRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/field-configs",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_SUBMIT);
            const items = await ArchiveSubmissionService.listActiveFieldConfigs();
            return { items };
        },
        {
            detail: {
                tags,
                summary: "Lấy cấu hình trường lưu kho đang áp dụng",
            },
        },
    );

    app.get(
        "/physical-location/levels",
        async ({ profile }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_SUBMIT,
                Permission.ARCHIVE_WAREHOUSE_MANAGE,
                Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
            ]);
            return await LevelService.list();
        },
        {
            detail: {
                tags,
                summary: "Cấp kho vật lý cho cascade chọn vị trí",
            },
        },
    );

    app.get(
        "/physical-location/items",
        async ({ profile, query }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_SUBMIT,
                Permission.ARCHIVE_WAREHOUSE_MANAGE,
                Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
            ]);
            return await ItemService.list({
                parentId: query.parentId ?? null,
                availableOnly:
                    query.availableOnly === "true" || query.availableOnly === true,
            });
        },
        {
            query: t.Object({
                parentId: t.Optional(t.String()),
                availableOnly: t.Optional(t.Union([t.String(), t.Boolean()])),
            }),
            detail: {
                tags,
                summary: "Cascade chọn vị trí kho (chỉ hộp còn chỗ khi availableOnly)",
            },
        },
    );

    app.get(
        "/physical-location/by-dossier/:dossierId",
        async ({ profile, params }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_SUBMIT,
                Permission.ARCHIVE_WAREHOUSE_READ,
                Permission.ARCHIVE_WAREHOUSE_MANAGE,
                Permission.PHYSICAL_WAREHOUSE_ITEM_READ,
            ]);
            return await PlacementService.getByDossier(params.dossierId);
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            detail: {
                tags,
                summary: "Vị trí kho vật lý hiện tại của hồ sơ",
            },
        },
    );

    app.post(
        "/physical-location/place",
        async ({ profile, body, set }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_WAREHOUSE_MANAGE,
                Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE,
            ]);
            const result = await PlacementService.place({
                dossierId: body.dossierId,
                physicalItemId: body.physicalItemId,
                placedBy: profile.id,
                notes: body.notes,
            });
            set.status = 201;
            return result;
        },
        {
            body: t.Object({
                dossierId: t.String(),
                physicalItemId: t.String(),
                notes: t.Optional(t.Union([t.String(), t.Null()])),
            }),
            detail: {
                tags,
                summary: "Xếp hồ sơ vào kho vật lý sau duyệt",
            },
        },
    );

    app.post(
        "/physical-location/move",
        async ({ profile, body }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_WAREHOUSE_MANAGE,
                Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE,
            ]);
            return await PlacementService.move({
                dossierId: body.dossierId,
                newPhysicalItemId: body.physicalItemId,
                placedBy: profile.id,
                notes: body.notes,
            });
        },
        {
            body: t.Object({
                dossierId: t.String(),
                physicalItemId: t.String(),
                notes: t.Optional(t.Union([t.String(), t.Null()])),
            }),
            detail: {
                tags,
                summary: "Đổi vị trí kho vật lý của hồ sơ",
            },
        },
    );

    app.post(
        "/physical-location/remove",
        async ({ profile, body }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_WAREHOUSE_MANAGE,
                Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE,
            ]);
            return await PlacementService.remove({
                dossierId: body.dossierId,
                notes: body.notes,
            });
        },
        {
            body: t.Object({
                dossierId: t.String(),
                notes: t.Optional(t.Union([t.String(), t.Null()])),
            }),
            detail: {
                tags,
                summary: "Gỡ hồ sơ khỏi kho vật lý",
            },
        },
    );

    app.get(
        "/pending",
        async ({ profile, urlQuery }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_REVIEW);
            return await ArchiveSubmissionService.getPendingSubmissions(urlQuery);
        },
        {
            detail: {
                tags,
                summary: "Danh sách đơn nộp lưu kho chờ duyệt",
            },
        },
    );

    app.get(
        "/dossiers",
        async ({ profile, urlQuery }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_SUBMIT);
            return await ArchiveSubmissionService.listArchiveDossiers(urlQuery);
        },
        {
            detail: {
                tags,
                summary: "Danh sách hồ sơ trong quy trình lưu kho",
            },
        },
    );

    app.get(
        "/dossier/:dossierId",
        async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_SUBMIT);
            const items = await ArchiveSubmissionService.getSubmissionsByDossier(params.dossierId);
            return { items };
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            detail: {
                tags,
                summary: "Lịch sử nộp lưu kho của hồ sơ",
            },
        },
    );

    app.get(
        "/:id",
        async ({ profile, params }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.ARCHIVE_SUBMIT,
                Permission.ARCHIVE_REVIEW,
            ]);
            const record = await ArchiveSubmissionService.getSubmission(params.id);
            return { record };
        },
        {
            params: t.Object({ id: IdParam("Archive submission ID") }),
            detail: {
                tags,
                summary: "Chi tiết đơn nộp lưu kho",
            },
        },
    );

    app.post(
        "/dossier/:dossierId",
        async ({ profile, params, body, set }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_SUBMIT);
            const record = await ArchiveSubmissionService.submitToArchive(
                params.dossierId,
                profile.id,
                body.fieldValues,
            );
            set.status = 201;
            return { record, status: "created" };
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            body: t.Object({
                fieldValues: fieldValuesSchema,
            }),
            detail: {
                tags,
                summary: "Nộp hồ sơ vào quy trình lưu kho",
            },
        },
    );

    app.post(
        "/:id/approve",
        async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_REVIEW);
            const record = await ArchiveSubmissionService.approveSubmission(
                params.id,
                profile.id,
            );
            return { record, status: "approved" };
        },
        {
            params: t.Object({ id: IdParam("Archive submission ID") }),
            detail: {
                tags,
                summary: "Duyệt đơn nộp lưu kho",
            },
        },
    );

    app.post(
        "/:id/reject",
        async ({ profile, params, body }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_REVIEW);
            const record = await ArchiveSubmissionService.rejectSubmission(
                params.id,
                profile.id,
                body.rejectNotes,
            );
            return { record, status: "rejected" };
        },
        {
            params: t.Object({ id: IdParam("Archive submission ID") }),
            body: t.Object({
                rejectNotes: t.String({ minLength: 1 }),
            }),
            detail: {
                tags,
                summary: "Từ chối đơn nộp lưu kho",
            },
        },
    );

    return app;
}
