import { Elysia, t } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { WATERMARK_POSITION_VALUES } from "../../db/schemas/watermark.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { WatermarkConfigService } from "./watermark-config-service.ts";

const positionSchema = t.Union(
    WATERMARK_POSITION_VALUES.map((value) => t.Literal(value)),
);

const opacitySchema = t.Integer({ minimum: 5, maximum: 50 });
const sizePercentSchema = t.Integer({ minimum: 5, maximum: 100 });

export function createWatermarkAdminRouter(basePath: string = "/watermark") {
    const tags = ["Admin", "Watermark"];

    const app = new Elysia({
        name: "watermarkAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.get(
        "/",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_READ);
            return await WatermarkConfigService.get();
        },
        {
            detail: {
                tags,
                summary: "Get system watermark config",
            },
        },
    );

    app.put(
        "/",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.update(body, profile.id);
        },
        {
            body: t.Object({
                textEnabled: t.Optional(t.Boolean()),
                textContent: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
                textOpacity: t.Optional(opacitySchema),
                textPosition: t.Optional(positionSchema),
                textSizePercent: t.Optional(sizePercentSchema),
                imageEnabled: t.Optional(t.Boolean()),
                imageOpacity: t.Optional(opacitySchema),
                imagePosition: t.Optional(positionSchema),
                imageSizePercent: t.Optional(sizePercentSchema),
            }),
            detail: {
                tags,
                summary: "Update system watermark config",
            },
        },
    );

    app.post(
        "/upload-point",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.createUploadPoint();
        },
        {
            detail: {
                tags,
                summary: "Create MinIO presigned POST for watermark image (PNG/SVG, max 5MB)",
            },
        },
    );

    app.post(
        "/confirm-upload",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.confirmUpload({
                ...body,
                actorId: profile.id,
            });
        },
        {
            body: t.Object({
                assetId: t.String({ format: "uuid" }),
                storageKey: t.String({ minLength: 1, maxLength: 1000 }),
                originalFilename: t.String({ minLength: 1, maxLength: 255 }),
            }),
            detail: {
                tags,
                summary: "Confirm watermark image upload and activate it",
            },
        },
    );

    app.delete(
        "/image",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.deleteImage(profile.id);
        },
        {
            detail: {
                tags,
                summary: "Soft-delete active watermark image (keep history)",
            },
        },
    );

    app.get(
        "/image-history",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_READ);
            return await WatermarkConfigService.listImageHistory();
        },
        {
            detail: {
                tags,
                summary: "List watermark image asset history",
            },
        },
    );

    return app;
}
