import { Elysia, t } from "elysia";
import { IdParam } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ArchiveSubmissionService } from "./archive-submission-service.ts";

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
