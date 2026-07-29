import { Elysia, t } from "elysia";
import { PaperSizeService as service } from "./paper-size-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    createPaperSizeBodySchema,
    paperSizeIdParamSchema,
    updatePaperSizeBodySchema,
} from "./types.ts";

export function createPaperSizeRouter(basePath: string = "/paper-sizes") {
    const tags = ["PaperSize"];

    const app = new Elysia({
        name: "paperSizeRouter",
        prefix: basePath,
    }).use(plugins.authProfile).use(plugins.urlQuery).use(plugins.auditLog);

    app.get(
        "",
        async ({ urlQuery, profile }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.METADATA_TEMPLATES_MANAGE,
                Permission.PROJECT_PLANS_READ,
            ]);
            return await service.list({
                limit: urlQuery.limit ? Number(urlQuery.limit) : undefined,
                offset: urlQuery.offset ? Number(urlQuery.offset) : undefined,
            });
        },
        {
            detail: { tags, summary: "List paper sizes" },
            query: t.Object({
                limit: t.Optional(t.String()),
                offset: t.Optional(t.String()),
            }),
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.METADATA_TEMPLATES_MANAGE,
                Permission.PROJECT_PLANS_READ,
            ]);
            return await service.get(params.id);
        },
        {
            params: paperSizeIdParamSchema,
            detail: { tags, summary: "Get paper size by ID" },
        },
    );

    app.post(
        "",
        async ({ body, profile }) => {
            authHelper.checkPermissionAny(profile, [
                Permission.METADATA_TEMPLATES_MANAGE,
                Permission.PROJECT_PLANS_CREATE,
            ]);
            return await service.create(body);
        },
        {
            body: createPaperSizeBodySchema,
            detail: { tags, summary: "Create a paper size" },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_TEMPLATES_MANAGE);
            return await service.update(params.id, body);
        },
        {
            params: paperSizeIdParamSchema,
            body: updatePaperSizeBodySchema,
            detail: { tags, summary: "Update a paper size" },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_TEMPLATES_MANAGE);
            return await service.delete(params.id);
        },
        {
            params: paperSizeIdParamSchema,
            detail: { tags, summary: "Soft delete paper size" },
        },
    );

    return app;
}
