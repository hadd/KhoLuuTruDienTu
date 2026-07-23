import { Elysia, t } from "elysia";
import { DocumentNamingConfigService as service } from "./document-naming-config-service.ts";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import {
    DOCUMENT_NAMING_SEGMENT_SOURCES,
    DOCUMENT_NAMING_TARGET_TYPES,
} from "../../libs/document-naming-types.ts";

const namingSegmentSchema = t.Object({
    length: t.Integer({ minimum: 1, maximum: 64 }),
    source: t.Union(DOCUMENT_NAMING_SEGMENT_SOURCES.map((value) => t.Literal(value))),
    value: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
    fieldKey: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    padChar: t.Optional(t.Nullable(t.String({ maxLength: 1 }))),
});

export function createDocumentNamingConfigAdminRouter(
    basePath: string = "/document-naming-configs",
) {
    const tags = ["Admin", "DocumentNamingConfig"];

    const app = new Elysia({
        name: "documentNamingConfigAdminRouter",
        prefix: basePath,
    }).use(plugins.authProfile);

    app.get(
        "/field-catalog",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_NAMING_MANAGE);
            return service.getFieldCatalog();
        },
        {
            detail: {
                tags,
                summary: "List available fond/dossier/file fields for naming segments",
            },
        },
    );

    app.get(
        "/dossier-options",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_NAMING_MANAGE);
            return await service.listDossierOptions({
                fondId: query.fondId,
                search: query.search,
                limit: query.limit,
            });
        },
        {
            query: t.Object({
                fondId: t.String({ minLength: 1 }),
                search: t.Optional(t.String()),
                limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
            }),
            detail: {
                tags,
                summary: "List dossiers in fond for file naming configuration",
            },
        },
    );

    app.get(
        "/",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_NAMING_MANAGE);
            return await service.getConfig({
                fondId: query.fondId,
                targetType: query.targetType,
                dossierId: query.dossierId,
            });
        },
        {
            query: t.Object({
                fondId: t.String({ minLength: 1 }),
                targetType: t.Union(
                    DOCUMENT_NAMING_TARGET_TYPES.map((value) => t.Literal(value)),
                ),
                dossierId: t.Optional(t.String({ format: "uuid" })),
            }),
            detail: {
                tags,
                summary: "Get document naming config for fond/dossier scope",
            },
        },
    );

    app.put(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_NAMING_MANAGE);
            return await service.upsertConfig(body);
        },
        {
            body: t.Object({
                fondId: t.String({ minLength: 1 }),
                targetType: t.Union(
                    DOCUMENT_NAMING_TARGET_TYPES.map((value) => t.Literal(value)),
                ),
                dossierId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
                segments: t.Array(namingSegmentSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Create or update document naming config",
            },
        },
    );

    app.post(
        "/preview",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_NAMING_MANAGE);
            return await service.preview(body);
        },
        {
            body: t.Object({
                fondId: t.String({ minLength: 1 }),
                targetType: t.Union(
                    DOCUMENT_NAMING_TARGET_TYPES.map((value) => t.Literal(value)),
                ),
                dossierId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
                segments: t.Array(namingSegmentSchema, { minItems: 1 }),
            }),
            detail: {
                tags,
                summary: "Preview generated name from segment rules",
            },
        },
    );

    return app;
}
