import { Elysia, t } from "elysia";
import { MetadataTemplateService as service } from "./metadata-template-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

export function createMetadataTemplateAdminRouter(basePath: string = "/metadata-templates") {
    const tags = ["Admin", "MetadataTemplate"];

    const app = new Elysia({
        name: "metadataTemplateAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/dossier-options",
        ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_READ);
            return service.listDossierOptions();
        },
        {
            detail: {
                tags,
                summary: "List OCR-ready dossiers for template creation",
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
                summary: "List metadata data templates",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_TEMPLATES_MANAGE);
            return await service.create(body);
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 255 }),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
                dossierId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Create metadata template from OCR dossier",
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
                summary: "Get metadata template by ID",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_TEMPLATES_MANAGE);
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
                summary: "Update metadata template",
            },
        },
    );

    app.patch(
        "/:id/toggle-active",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_TEMPLATES_MANAGE);
            
            let isActive: boolean | undefined = undefined;
            if (body && body.isActive !== undefined) {
                // Handle string coercions if needed, although TypeBox handles boolean parsing sometimes
                isActive = body.isActive === "true" || body.isActive === true;
            }
            
            return await service.toggleActive(params.id, isActive);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Optional(
                t.Object({
                    isActive: t.Optional(t.Union([t.Boolean(), t.String()])),
                })
            ),
            detail: {
                tags,
                summary: "Toggle metadata template active status",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_TEMPLATES_MANAGE);
            return await service.delete(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Soft-delete metadata template",
            },
        },
    );

    return app;
}
