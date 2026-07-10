import {
    boolean,
    integer,
    smallint,
    text,
    timestamp,
    uuid,
    varchar,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

export const WATERMARK_POSITION_VALUES = [
    "center",
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
    "tile_grid",
] as const;

export type WatermarkPosition = typeof WATERMARK_POSITION_VALUES[number];

export const WATERMARK_IMAGE_STATUS_VALUES = [
    "active",
    "superseded",
    "deleted",
] as const;

export type WatermarkImageStatus = typeof WATERMARK_IMAGE_STATUS_VALUES[number];

export const watermarkImageAssets = schema.table("watermark_image_assets", {
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("watermark_image_assets_status_idx").on(table.status),
    index("watermark_image_assets_created_at_idx").on(table.createdAt),
]);

export const watermarkConfigs = schema.table("watermark_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    textEnabled: boolean("text_enabled").notNull().default(false),
    textContent: text("text_content"),
    textOpacity: smallint("text_opacity").notNull().default(30),
    textPosition: varchar("text_position", { length: 32 }).notNull().default("center"),
    textSizePercent: smallint("text_size_percent").notNull().default(20),
    imageEnabled: boolean("image_enabled").notNull().default(false),
    imageOpacity: smallint("image_opacity").notNull().default(30),
    imagePosition: varchar("image_position", { length: 32 }).notNull().default("center"),
    imageSizePercent: smallint("image_size_percent").notNull().default(30),
    activeImageAssetId: uuid("active_image_asset_id").references(() => watermarkImageAssets.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedById: uuid("updated_by_id").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WatermarkConfig = typeof watermarkConfigs.$inferSelect;
export type NewWatermarkConfig = typeof watermarkConfigs.$inferInsert;
export type WatermarkImageAsset = typeof watermarkImageAssets.$inferSelect;
export type NewWatermarkImageAsset = typeof watermarkImageAssets.$inferInsert;

export const watermarkImageAssetsRelations = relations(watermarkImageAssets, ({ one }) => ({
    uploadedBy: one(userProfiles, {
        fields: [watermarkImageAssets.uploadedById],
        references: [userProfiles.id],
    }),
}));

export const watermarkConfigsRelations = relations(watermarkConfigs, ({ one }) => ({
    activeImageAsset: one(watermarkImageAssets, {
        fields: [watermarkConfigs.activeImageAssetId],
        references: [watermarkImageAssets.id],
    }),
    updatedBy: one(userProfiles, {
        fields: [watermarkConfigs.updatedById],
        references: [userProfiles.id],
    }),
}));
