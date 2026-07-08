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
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
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
        async ({ profile, urlQuery }) => {
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
            return await service.list(urlQuery.status as "ready" | "draft" | "close" | undefined);
        },
        {
            query: t.Object({
                status: t.Optional(t.Union([t.Literal("ready"), t.Literal("draft"), t.Literal("close")])),
            }),
            detail: {
                tags,
                summary: "List metadata permission configs",
            },
        },
    );

    app.post(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
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
                summary: "Create metadata permission config draft",
                description:
                    "Creates a draft config from a template. Configure slots separately via PUT /:id/slots.",
            },
        },
    );

    app.get(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
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
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
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

    app.patch(
        "/:id/status",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
            return await service.updateStatus(params.id, body.status);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                status: t.Union([t.Literal("ready"), t.Literal("close")]),
            }),
            detail: {
                tags,
                summary: "Toggle metadata permission config status",
                description: "Toggle status between 'ready' and 'close'. Cannot set to 'ready' if current status is 'draft'.",
            },
        },
    );

    app.put(
        "/:id/slots",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
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
                description:
                    "Defines or updates slot field coverage. Validates full catalog coverage with no overlaps, then sets status to ready.",
            },
        },
    );

    app.delete(
        "/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.METADATA_PERMISSIONS_MANAGE);
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
