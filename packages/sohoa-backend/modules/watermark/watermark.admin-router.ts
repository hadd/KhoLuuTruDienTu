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
        "/image",
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
                summary: "Upload watermark image (png/svg, max 5MB) and activate it",
                description:
                    "Nhận file .png hoặc .svg (không phân biệt hoa/thường, ví dụ logo.PNG / mark.SVG). BE validate, lưu MinIO và kích hoạt ảnh.",
            },
        },
    );

    app.delete(
        "/image/:assetId",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_MANAGE);
            return await WatermarkConfigService.deleteImage(params.assetId, profile.id);
        },
        {
            params: t.Object({
                assetId: t.String({ format: "uuid" }),
            }),
            detail: {
                tags,
                summary: "Hard-delete a watermark image asset by id (DB + MinIO)",
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
