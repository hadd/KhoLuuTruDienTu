import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";
import { listHistory, getVersionContent, restoreVersion } from "./metadata-history-service.ts";

const tags = ["Metadata History"];

export function createMetadataHistoryRouter() {
    const app = new Elysia({ name: "metadataHistoryRouter" })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/dossiers/:id/metadata-history",
        async ({ params, profile }) => {
            authHelper.checkDossierWorkflowDataAccess(profile);
            return await listHistory(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Danh sách lịch sử thay đổi metadata",
                description: "Trả về danh sách các phiên bản metadata của hồ sơ, sắp xếp theo version mới nhất trước. Mỗi phiên bản có field_changes mô tả các trường đã thay đổi so với phiên bản liền trước.",
            },
        },
    );

    app.get(
        "/dossiers/:id/metadata-history/:historyId",
        async ({ params, profile }) => {
            authHelper.checkDossierWorkflowDataAccess(profile);
            return await getVersionContent(params.id, params.historyId);
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
                historyId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Chi tiết một phiên bản metadata",
                description: "Trả về nội dung đầy đủ JSON metadata của phiên bản được chỉ định, cùng với thông tin diff so với phiên bản trước.",
            },
        },
    );

    app.post(
        "/dossiers/:id/metadata-history/:historyId/restore",
        async ({ params, profile }) => {
            await authHelper.checkWorkflowAccess(profile, {
                permission: Permission.DATA_ENTRY_MAKER,
                workerRoles: [WorkerRole.MAKER],
                dossierId: params.id,
            });
            const result = await restoreVersion(params.id, params.historyId, profile.id);
            return {
                dossierId: params.id,
                restoredFromHistoryId: params.historyId,
                newVersionNumber: result.versionNumber,
                s3Key: result.s3Key,
            };
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
                historyId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Khôi phục về phiên bản metadata cũ",
                description: "Sao chép nội dung phiên bản lịch sử được chỉ định thành phiên bản mới và cập nhật current_metadata_key của hồ sơ. Yêu cầu quyền data-entry.maker và assignment MAKER đang xử lý.",
            },
        },
    );

    return app;
}
