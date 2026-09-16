import { t } from "elysia";

export const metadataFieldIdParamSchema = t.Object({
    id: t.String({ format: "uuid", description: "UUID trường metadata" }),
});

export const metadataFieldQuerySchema = t.Object({
    metadataExtractModeCode: t.Optional(t.String({ description: "Lọc theo mã chế độ bóc tách metadata" })),
    groupCode: t.Optional(t.String({ description: "Lọc theo mã nhóm" })),
    fieldCode: t.Optional(t.String({ description: "Lọc theo mã trường" })),
    description: t.Optional(t.String({ description: "Lọc theo mô tả" })),
    isHidden: t.Optional(t.Union([t.Boolean(), t.String()], { description: "Lọc theo trạng thái ẩn" })),
    search: t.Optional(t.String({ description: "Tìm kiếm theo mã trường hoặc mô tả" })),
    limit: t.Optional(t.String({ description: "Số lượng bản ghi mỗi trang" })),
    offset: t.Optional(t.String({ description: "Vị trí bắt đầu lấy bản ghi" })),
});

export const metadataFieldItemSchema = t.Object({
    groupCode: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    fieldCode: t.String({ minLength: 1, maxLength: 100, description: "Mã trường metadata" }),
    description: t.Optional(t.Nullable(t.String())),
    isHidden: t.Optional(t.Boolean()),
});

export const createMetadataFieldBodySchema = t.Object({
    metadataExtractModeCode: t.String({ minLength: 1, description: "Mã chế độ bóc tách metadata" }),
    metadata: t.Optional(t.Array(metadataFieldItemSchema, { description: "Danh sách các trường metadata" })),
    groupCode: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    fieldCode: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    description: t.Optional(t.Nullable(t.String())),
    isHidden: t.Optional(t.Boolean()),
});

export const updateMetadataFieldBodySchema = t.Object({
    metadataExtractModeCode: t.Optional(t.Nullable(t.String())),
    groupCode: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    fieldCode: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    description: t.Optional(t.Nullable(t.String())),
    isHidden: t.Optional(t.Boolean()),
});

export type CreateMetadataFieldInput = typeof createMetadataFieldBodySchema.static;
export type UpdateMetadataFieldInput = typeof updateMetadataFieldBodySchema.static;
export type MetadataFieldQuery = typeof metadataFieldQuerySchema.static;
