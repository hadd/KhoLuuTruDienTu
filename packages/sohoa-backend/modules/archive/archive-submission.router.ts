import { Elysia, t } from "elysia";
import { httpError, IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import type { UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { ArchiveSubmissionService } from "./archive-submission-service.ts";
import { hasArchiveWarehousePermission } from "./archive-warehouse-permissions.ts";
import { ItemService } from "../physical-warehouse/physical-warehouse-service.ts";
import { PlacementService } from "../physical-warehouse/physical-placement-service.ts";
import { hasPhysicalWarehouseContentsManage } from "../physical-warehouse/physical-warehouse-permissions.ts";
import { hasArchiveDisposalReadPermission } from "../archive-disposal/archive-disposal-permissions.ts";

import type { RequestWithAuditMeta } from "../audit-log/audit-log-activity.ts";

const tags = ["Archive Submission"];

function skipAutoAuditLog({ request }: { request: Request }) {
    (request as RequestWithAuditMeta).__auditMeta = { skip: true };
}

const fieldValuesSchema = t.Record(t.String(), t.Unknown());

const fileSecurityLevelItemSchema = t.Object({
    fileId: t.String({ format: "uuid" }),
    securityLevelId: t.String({ format: "uuid" }),
});

const submitArchiveBodySchema = t.Object({
    fieldValues: fieldValuesSchema,
    securityLevelId: t.String({ format: "uuid" }),
    fileSecurityLevels: t.Array(fileSecurityLevelItemSchema),
});

function canBrowsePhysicalLocationForArchive(profile: UserWithRoles) {
    if (
        authHelper.hasPermission(profile, Permission.ARCHIVE_SUBMIT) ||
        authHelper.hasPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ) ||
        hasArchiveDisposalReadPermission(profile) ||
        hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_READ) ||
        hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT) ||
        hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_DELETE)
    ) {
        return;
    }
    throw httpError.forbidden("Bạn không có quyền xem vị trí kho vật lý");
}

function canMutatePhysicalPlacement(profile: UserWithRoles) {
    if (
        hasPhysicalWarehouseContentsManage(profile) ||
        hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT)
    ) {
        return;
    }
    throw httpError.forbidden("Bạn không có quyền xếp / chuyển vị trí kho vật lý");
}

function canRemovePhysicalPlacement(profile: UserWithRoles) {
    if (
        hasPhysicalWarehouseContentsManage(profile) ||
        hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_EDIT) ||
        hasArchiveWarehousePermission(profile, Permission.ARCHIVE_WAREHOUSE_DELETE)
    ) {
        return;
    }
    throw httpError.forbidden("Bạn không có quyền gỡ hồ sơ khỏi kho vật lý");
}

export function createArchiveSubmissionRouter(basePath: string = "/archive-submissions") {
    const app = new Elysia({
        name: "archiveSubmissionRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile)
        .use(plugins.auditLog);

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
        "/physical-location/items",
        async ({ profile, query }) => {
            canBrowsePhysicalLocationForArchive(profile);
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
        "/physical-location/boxes",
        async ({ profile, query }) => {
            canBrowsePhysicalLocationForArchive(profile);
            return await ItemService.listBottomBoxes({
                availableOnly:
                    query.availableOnly === "true" || query.availableOnly === true,
            });
        },
        {
            query: t.Object({
                availableOnly: t.Optional(t.Union([t.String(), t.Boolean()])),
            }),
            detail: {
                tags,
                summary: "Danh sách hộp (cấp cuối) kèm đường dẫn đầy đủ",
            },
        },
    );

    app.get(
        "/physical-location/by-dossier/:dossierId",
        async ({ profile, params }) => {
            canBrowsePhysicalLocationForArchive(profile);
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
            canMutatePhysicalPlacement(profile);
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
            canMutatePhysicalPlacement(profile);
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
            canRemovePhysicalPlacement(profile);
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
        "/dossier/:dossierId/prepare",
        async ({ profile, params }) => {
            authHelper.checkPermission(profile, Permission.ARCHIVE_SUBMIT);
            const record = await ArchiveSubmissionService.prepareArchiveSubmit(params.dossierId);
            return { record };
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            detail: {
                tags,
                summary: "Dữ liệu chuẩn bị form nộp lưu kho (phông, bảo mật từ metadata, trường động)",
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
                {
                    securityLevelId: body.securityLevelId,
                    fileSecurityLevels: body.fileSecurityLevels,
                },
            );
            set.status = 201;
            return { record, status: "created" };
        },
        {
            params: t.Object({ dossierId: IdParam("Dossier ID") }),
            body: submitArchiveBodySchema,
            beforeHandle: skipAutoAuditLog,
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
            beforeHandle: skipAutoAuditLog,
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
            beforeHandle: skipAutoAuditLog,
            detail: {
                tags,
                summary: "Từ chối đơn nộp lưu kho",
            },
        },
    );

    return app;
}
