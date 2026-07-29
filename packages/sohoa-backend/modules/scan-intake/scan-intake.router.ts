import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ScanIntakeService as service } from "./scan-intake-service.ts";
import {
    assemblePdfBodySchema,
    deletePageBodySchema,
    deletePagesBodySchema,
    deleteDocumentBodySchema,
    listSessionQuerySchema,
    organizeMoveBodySchema,
    organizeRenameFolderBodySchema,
    organizeRenamePdfBodySchema,
    presignedGetBodySchema,
    promoteBodySchema,
    reorderPagesBodySchema,
    uploadPointBodySchema,
    deleteSessionBodySchema,
} from "./types.ts";

const tags = ["Scan Intake"];

export function createScanIntakeRouter(basePath: string = "/scan-intake") {
    const app = new Elysia({
        name: "scanIntakeRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.post(
        "/upload-point",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.createUploadPoint(body);
        },
        {
            body: uploadPointBodySchema,
            detail: {
                tags,
                summary: "Presigned PUT URL for scan-draft object",
            },
        },
    );

    app.post(
        "/presigned-get",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.createPresignedGet(body);
        },
        {
            body: presignedGetBodySchema,
            detail: {
                tags,
                summary: "Presigned GET URL for scan-draft object",
            },
        },
    );

    app.get(
        "/sessions",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.listSessions();
        },
        {
            detail: {
                tags,
                summary: "List scan-draft workspace sessions",
            },
        },
    );

    app.get(
        "/session",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.listSession(query);
        },
        {
            query: listSessionQuerySchema,
            detail: {
                tags,
                summary: "List inbox documents and organized folders in a session",
            },
        },
    );

    app.post(
        "/assemble-pdf",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.assemblePdf(body);
        },
        {
            body: assemblePdfBodySchema,
            detail: {
                tags,
                summary: "Assemble page images into a PDF named after the document on MinIO",
            },
        },
    );

    app.post(
        "/pages/reorder",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.reorderPages(body);
        },
        {
            body: reorderPagesBodySchema,
            detail: {
                tags,
                summary: "Reorder page images by renaming keys",
            },
        },
    );

    app.post(
        "/pages/delete",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.deletePage(body);
        },
        {
            body: deletePageBodySchema,
            detail: {
                tags,
                summary: "Delete a page image from scan-draft",
            },
        },
    );

    app.post(
        "/pages/delete-bulk",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.deletePages(body);
        },
        {
            body: deletePagesBodySchema,
            detail: {
                tags,
                summary: "Delete multiple page images from scan-draft",
            },
        },
    );

    app.post(
        "/document/delete",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.deleteDocument(body);
        },
        {
            body: deleteDocumentBodySchema,
            detail: {
                tags,
                summary: "Delete a document and all its pages from scan-draft",
            },
        },
    );

    app.post(
        "/organize-move",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.organizeMove(body);
        },
        {
            body: organizeMoveBodySchema,
            detail: {
                tags,
                summary: "Move PDF between folders in scan-draft session",
            },
        },
    );

    app.post(
        "/organize-rename-folder",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.organizeRenameFolder(body);
        },
        {
            body: organizeRenameFolderBodySchema,
            detail: {
                tags,
                summary: "Rename an organize folder in scan-draft session",
            },
        },
    );

    app.post(
        "/organize-rename-pdf",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.organizeRenamePdf(body);
        },
        {
            body: organizeRenamePdfBodySchema,
            detail: {
                tags,
                summary: "Rename a PDF file in scan-draft session",
            },
        },
    );

    app.post(
        "/promote",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.promote(body);
        },
        {
            body: promoteBodySchema,
            detail: {
                tags,
                summary: "Copy organized PDFs to raw/ and register in DB",
            },
        },
    );

    app.post(
        "/session/delete",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.SCAN_INTAKE_USE);
            return await service.deleteSession(body);
        },
        {
            body: deleteSessionBodySchema,
            detail: {
                tags,
                summary: "Delete all objects in a scan-draft session",
            },
        },
    );

    return app;
}
