import { Elysia, t } from "elysia";
import { MetadataPermissionService as service } from "./metadata-permission-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

const slotSchema = t.Object({
    slotCode: t.String({ minLength: 1 }),
    slotName: t.String({ minLength: 1 }),
    fieldKeys: t.Array(t.String({ minLength: 1 }), { minItems: 1 }),
});

export function createMetadataPermissionAdminRouter(
    basePath: string = "/metadata-permission-configs",
) {
    const tags = ["Admin", "MetadataPermission"];

    const app = new Elysia({
        name: "metadataPermissionAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/template-options",
        ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return service.listTemplateOptions();
        },
        {
            detail: {
                tags,
                summary: "List templates for permission config creation",
            },
        },
    );

    app.get(
        "/options",
        ({ profile }) => {
            authHelper.checkPermission(profile, Permission.GROUPS_READ);
            return service.listReadyOptions();
        },
        {
            detail: {
                tags,
                summary: "List ready permission configs for group binding",
            },
        },
    );

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.list();
        },
        {
            detail: {
                tags,
                summary: "List metadata permission configs",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            return await service.create(body);
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 255 }),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
                templateId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Create metadata permission config from template",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return await service.get(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Get metadata permission config",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            return await service.update(params.id, body);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
            }),
            detail: {
                tags,
                summary: "Update metadata permission config",
            },
        },
    );

    app.put(
        "/:id/slots",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            return await service.setSlots(params.id, body.slots);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                slots: t.Array(slotSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Set permission slots and mark config ready",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_WRITE);
            return await service.delete(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Soft-delete metadata permission config",
            },
        },
    );

    return app;
}
