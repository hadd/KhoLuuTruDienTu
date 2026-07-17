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
const offsetPercentSchema = t.Integer({ minimum: 0, maximum: 100 });
const rotationSchema = t.Integer({ minimum: -180, maximum: 180 });

const stampSchema = t.Object({
  offsetXPercent: offsetPercentSchema,
  offsetYPercent: offsetPercentSchema,
  rotationDegrees: t.Optional(rotationSchema),
});

const placementFields = {
  imageAssetId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
  imageEnabled: t.Optional(t.Boolean()),
  imageOpacity: t.Optional(opacitySchema),
  imagePosition: t.Optional(positionSchema),
  imageSizePercent: t.Optional(sizePercentSchema),
  imageOffsetXPercent: t.Optional(t.Nullable(offsetPercentSchema)),
  imageOffsetYPercent: t.Optional(t.Nullable(offsetPercentSchema)),
  imageRotationDegrees: t.Optional(rotationSchema),
  imageStamps: t.Optional(t.Nullable(t.Array(stampSchema, { maxItems: 20 }))),
  textEnabled: t.Optional(t.Boolean()),
  textContent: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  textOpacity: t.Optional(opacitySchema),
  textPosition: t.Optional(positionSchema),
  textSizePercent: t.Optional(sizePercentSchema),
  textOffsetXPercent: t.Optional(t.Nullable(offsetPercentSchema)),
  textOffsetYPercent: t.Optional(t.Nullable(offsetPercentSchema)),
  textRotationDegrees: t.Optional(rotationSchema),
  textStamps: t.Optional(t.Nullable(t.Array(stampSchema, { maxItems: 20 }))),
};

const placementBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
  ...placementFields,
});

const placementCreateBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  ...placementFields,
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
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_CREATE);
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
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_DELETE);
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
        summary: "List watermark placements (summary)",
        description:
          "Returns compact placement rows. Use GET /placements/:id for full config (offsets, stamps, imageAsset).",
      },
    },
  );

  app.post(
    "/placements",
    async ({ body, profile }) => {
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_CREATE);
      return await WatermarkConfigService.createPlacement(body, profile.id);
    },
    {
      body: placementCreateBodySchema,
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
        summary: "Get watermark placement by id (full detail)",
      },
    },
  );

  app.put(
    "/placements/:id",
    async ({ params, body, profile }) => {
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_UPDATE);
      return await WatermarkConfigService.updatePlacement(
        params.id,
        body,
        profile.id,
      );
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

  app.patch(
    "/placements/:id/active",
    async ({ params, body, profile }) => {
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_UPDATE);
      return await WatermarkConfigService.setPlacementActive(
        params.id,
        body.isActive,
        profile.id,
      );
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        isActive: t.Boolean(),
      }),
      detail: {
        tags,
        summary: "Activate or deactivate one watermark placement",
        description:
          "Activating a placement automatically deactivates every other placement. " +
          "Deactivating the current active placement auto-promotes the most recently updated other placement. " +
          "Cannot deactivate the only remaining placement.",
      },
    },
  );

  app.delete(
    "/placements/:id",
    async ({ params, profile }) => {
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_DELETE);
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

  const pdfSecurityBodySchema = t.Object({
    enabled: t.Optional(t.Boolean()),
    allowPrinting: t.Optional(t.Boolean()),
    allowChanging: t.Optional(t.Boolean()),
    allowDocumentAssembly: t.Optional(t.Boolean()),
    allowContentCopying: t.Optional(t.Boolean()),
    allowContentCopyingAccessibility: t.Optional(t.Boolean()),
    allowPageExtraction: t.Optional(t.Boolean()),
    allowCommenting: t.Optional(t.Boolean()),
    allowFormFilling: t.Optional(t.Boolean()),
    allowSigning: t.Optional(t.Boolean()),
  });

  app.get(
    "/pdf-security",
    async ({ profile }) => {
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_READ);
      return await WatermarkConfigService.getPdfSecurity();
    },
    {
      detail: {
        tags,
        summary: "Get shared PDF document restrictions (all placements)",
      },
    },
  );

  app.put(
    "/pdf-security",
    async ({ body, profile }) => {
      authHelper.checkPermission(profile, Permission.WATERMARK_CONFIG_UPDATE);
      return await WatermarkConfigService.updatePdfSecurity(body, profile.id);
    },
    {
      body: pdfSecurityBodySchema,
      detail: {
        tags,
        summary: "Update shared PDF document restrictions (all placements)",
      },
    },
  );

  return app;
}
