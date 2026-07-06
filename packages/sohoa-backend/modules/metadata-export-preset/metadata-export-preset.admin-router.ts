import { Elysia, t } from "elysia";
import { MetadataExportPresetService as service } from "./metadata-export-preset-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";

/** Preset storage: columns may be drafted with no fields assigned yet. */
const exportPresetColumnSchema = t.Object({
    header: t.String({ minLength: 1, maxLength: 255 }),
    fieldKeys: t.Array(t.String({ minLength: 1 })),
    separator: t.String({ maxLength: 32 }),
});

export function createMetadataExportPresetAdminRouter(
    basePath: string = "/metadata-export-presets",
) {
    const tags = ["Admin", "MetadataExportPreset"];

    const app = new Elysia({
        name: "metadataExportPresetAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/export-options",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.DOSSIERS_EXPORT);
            return await service.listOptions();
        },
        {
            detail: {
                tags,
                summary: "List metadata export preset options for dossier export",
            },
        },
    );

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_EXPORT_PRESETS_MANAGE);
            return await service.list();
        },
        {
            detail: {
                tags,
                summary: "List metadata export presets",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_EXPORT_PRESETS_MANAGE);
            return await service.create(body);
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 255 }),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
                columns: t.Array(exportPresetColumnSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Create metadata export preset",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_EXPORT_PRESETS_MANAGE);
            return await service.get(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Get metadata export preset by ID",
            },
        },
    );

    app.patch(
        "/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_EXPORT_PRESETS_MANAGE);
            return await service.update(params.id, body);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 255 }),
                description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
                columns: t.Array(exportPresetColumnSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Update metadata export preset",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_EXPORT_PRESETS_MANAGE);
            return await service.remove(params.id);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            detail: {
                tags,
                summary: "Delete metadata export preset",
            },
        },
    );

    return app;
}
