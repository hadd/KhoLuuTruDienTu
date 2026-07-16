import {
  boolean,
  index,
  integer,
  jsonb,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

export const WATERMARK_POSITION_VALUES = [
  "center",
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
  "tile_grid",
  "custom",
] as const;

export type WatermarkPosition = (typeof WATERMARK_POSITION_VALUES)[number];

export type WatermarkStamp = {
  offsetXPercent: number;
  offsetYPercent: number;
  rotationDegrees?: number;
};

export const WATERMARK_IMAGE_STATUS_VALUES = [
  "active",
  "superseded",
  "deleted",
] as const;

export type WatermarkImageStatus =
  (typeof WATERMARK_IMAGE_STATUS_VALUES)[number];

/** Shared image library — one image can be used by many placements. */
export const watermarkImageAssets = schema.table(
  "watermark_image_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storageKey: text("storage_key").notNull(),
    rasterStorageKey: text("raster_storage_key"),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    uploadedById: uuid("uploaded_by_id").references(() => userProfiles.id, {
      onDelete: "set null",
      onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("watermark_image_assets_status_idx").on(table.status),
    index("watermark_image_assets_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Placement = how to stamp a watermark (position/opacity/size/text).
 * Multiple placements may share the same imageAssetId.
 * Export selects exactly one placementId.
 */
export const watermarkPlacements = schema.table(
  "watermark_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    imageAssetId: uuid("image_asset_id").references(
      () => watermarkImageAssets.id,
      {
        onDelete: "set null",
        onUpdate: "restrict",
      },
    ),
    imageEnabled: boolean("image_enabled").notNull().default(false),
    imageOpacity: smallint("image_opacity").notNull().default(30),
    imagePosition: varchar("image_position", { length: 32 })
      .notNull()
      .default("center"),
    imageSizePercent: smallint("image_size_percent").notNull().default(30),
    imageOffsetXPercent: smallint("image_offset_x_percent"),
    imageOffsetYPercent: smallint("image_offset_y_percent"),
    imageRotationDegrees: smallint("image_rotation_degrees")
      .notNull()
      .default(0),
    imageStamps: jsonb("image_stamps").$type<WatermarkStamp[] | null>(),
    textEnabled: boolean("text_enabled").notNull().default(false),
    textContent: text("text_content"),
    textOpacity: smallint("text_opacity").notNull().default(30),
    textPosition: varchar("text_position", { length: 32 })
      .notNull()
      .default("center"),
    textSizePercent: smallint("text_size_percent").notNull().default(20),
    textOffsetXPercent: smallint("text_offset_x_percent"),
    textOffsetYPercent: smallint("text_offset_y_percent"),
    textRotationDegrees: smallint("text_rotation_degrees").notNull().default(0),
    textStamps: jsonb("text_stamps").$type<WatermarkStamp[] | null>(),
    updatedById: uuid("updated_by_id").references(() => userProfiles.id, {
      onDelete: "set null",
      onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("watermark_placements_single_active_idx")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
    index("watermark_placements_image_asset_id_idx").on(table.imageAssetId),
    index("watermark_placements_created_at_idx").on(table.createdAt),
  ],
);

export type WatermarkPlacement = typeof watermarkPlacements.$inferSelect;
export type NewWatermarkPlacement = typeof watermarkPlacements.$inferInsert;
export type WatermarkImageAsset = typeof watermarkImageAssets.$inferSelect;
export type NewWatermarkImageAsset = typeof watermarkImageAssets.$inferInsert;

export const watermarkImageAssetsRelations = relations(
  watermarkImageAssets,
  ({ one, many }) => ({
    uploadedBy: one(userProfiles, {
      fields: [watermarkImageAssets.uploadedById],
      references: [userProfiles.id],
    }),
    placements: many(watermarkPlacements),
  }),
);

export const watermarkPlacementsRelations = relations(
  watermarkPlacements,
  ({ one }) => ({
    imageAsset: one(watermarkImageAssets, {
      fields: [watermarkPlacements.imageAssetId],
      references: [watermarkImageAssets.id],
    }),
    updatedBy: one(userProfiles, {
      fields: [watermarkPlacements.updatedById],
      references: [userProfiles.id],
    }),
  }),
);
