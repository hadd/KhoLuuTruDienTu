import { httpError } from "@shared/common-lib";
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

const placementBodySchema = t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
    imageAssetId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
    imageEnabled: t.Optional(t.Boolean()),
    imageOpacity: t.Optional(opacitySchema),
    imagePosition: t.Optional(positionSchema),
    imageSizePercent: t.Optional(sizePercentSchema),
    textEnabled: t.Optional(t.Boolean()),
    textContent: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
    textOpacity: t.Optional(opacitySchema),
    textPosition: t.Optional(positionSchema),
    textSizePercent: t.Optional(sizePercentSchema),
});

export function createWatermarkAdminRouter(basePath: string = "/watermark") {
    const tags = ["Admin", "Watermark"];

    const app = new Elysia({
        name: "watermarkAdminRouter",
        prefix: basePath,
    })
        .use(plugins.authProfile)
        .use(plugins.auditLog);

    app.get(
        "/images",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_READ);
            return await WatermarkConfigService.listImages();
        },
        {
            detail: {
                tags,
                summary: "List watermark image library",
            },
        },
    );

    app.post(
        "/images",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            const file = body.file as File | undefined;
            if (!file) {
                throw httpError.badRequest("Chưa tải lên file ảnh watermark");
            }
            return await WatermarkConfigService.uploadImage({
                file,
                actorId: profile.id,
            });
        },
        {
            body: t.Object({
                file: t.File(),
            }),
            detail: {
                tags,
                summary: "Upload watermark image (png/svg, max 5MB)",
            },
        },
    );

    app.delete(
        "/images/:assetId",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.deleteImage(params.assetId);
        },
        {
            params: t.Object({
                assetId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Hard-delete watermark image (blocked if used by placements)",
            },
        },
    );

    app.get(
        "/placements",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_READ);
            return await WatermarkConfigService.listPlacements();
        },
        {
            detail: {
                tags,
                summary: "List watermark placements",
            },
        },
    );

    app.post(
        "/placements",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.createPlacement(body, profile.id);
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 120 }),
                imageAssetId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
                imageEnabled: t.Optional(t.Boolean()),
                imageOpacity: t.Optional(opacitySchema),
                imagePosition: t.Optional(positionSchema),
                imageSizePercent: t.Optional(sizePercentSchema),
                textEnabled: t.Optional(t.Boolean()),
                textContent: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
                textOpacity: t.Optional(opacitySchema),
                textPosition: t.Optional(positionSchema),
                textSizePercent: t.Optional(sizePercentSchema),
            }),
            detail: {
                tags,
                summary: "Create watermark placement",
            },
        },
    );

    app.get(
        "/placements/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_READ);
            return await WatermarkConfigService.getPlacement(params.id);
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Get watermark placement by id",
            },
        },
    );

    app.put(
        "/placements/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.updatePlacement(params.id, body, profile.id);
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
            body: placementBodySchema,
            detail: {
                tags,
                summary: "Update watermark placement",
            },
        },
    );

    app.delete(
        "/placements/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.deletePlacement(params.id);
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Delete watermark placement",
            },
        },
    );

    return app;
}
