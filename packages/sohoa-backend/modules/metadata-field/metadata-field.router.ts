import { Elysia } from "elysia";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { MetadataFieldService } from "./metadata-field-service.ts";
import {
    createMetadataFieldBodySchema,
    metadataFieldIdParamSchema,
    metadataFieldQuerySchema,
    updateMetadataFieldBodySchema,
} from "./types.ts";

export function createMetadataFieldRouter(basePath: string = "/metadata-fields") {
    const tags = ["MetadataField"];

    return new Elysia({ name: "metadataFieldRouter", prefix: basePath })
        .use(plugins.authProfile)
        .use(plugins.urlQuery)
        .use(plugins.auditLog)
        .get(
            "/",
            async ({ urlQuery, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_FIELDS_READ,
                );
                const data = await MetadataFieldService.list(urlQuery);
                return { success: true, data };
            },
            {
                query: metadataFieldQuerySchema,
                detail: {
                    tags,
                    summary: "Danh sách trường siêu dữ liệu metadata",
                    description: "Lọc theo model bóc tách, mã nhóm, trạng thái ẩn, từ khóa tìm kiếm",
                },
            },
        )
        .get(
            "/active",
            async ({ urlQuery }) => {
                const activeHiddenFields =
                    await MetadataFieldService.getActiveHiddenFields(urlQuery);
                return { success: true, activeHiddenFields };
            },
            {
                query: metadataFieldQuerySchema,
                detail: {
                    tags,
                    summary: "Lấy danh sách mã trường metadata đang bị ẩn",
                    description: "Hỗ trợ lọc theo mode bóc tách, mã nhóm, từ khóa tìm kiếm...",
                },
            },
        )
        .get(
            "/:id",
            async ({ params, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_FIELDS_READ,
                );
                const data = await MetadataFieldService.getById(params.id);
                return { success: true, data };
            },
            {
                params: metadataFieldIdParamSchema,
                detail: {
                    tags,
                    summary: "Lấy chi tiết trường siêu dữ liệu theo ID",
                },
            },
        )
        .post(
            "/",
            async ({ body, profile, set }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_FIELDS_UPDATE,
                );
                const data = await MetadataFieldService.create(body);
                set.status = 201;
                return { success: true, data };
            },
            {
                body: createMetadataFieldBodySchema,
                detail: {
                    tags,
                    summary: "Tạo mới trường siêu dữ liệu metadata",
                },
            },
        )
        .put(
            "/:id",
            async ({ params, body, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_FIELDS_UPDATE,
                );
                const data = await MetadataFieldService.update(params.id, body);
                return { success: true, data };
            },
            {
                params: metadataFieldIdParamSchema,
                body: updateMetadataFieldBodySchema,
                detail: {
                    tags,
                    summary: "Cập nhật thông tin trường siêu dữ liệu",
                },
            },
        )
        .patch(
            "/:id",
            async ({ params, body, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_FIELDS_UPDATE,
                );
                const data = await MetadataFieldService.update(params.id, body);
                return { success: true, data };
            },
            {
                params: metadataFieldIdParamSchema,
                body: updateMetadataFieldBodySchema,
                detail: {
                    tags,
                    summary: "Cập nhật từng phần trường siêu dữ liệu",
                },
            },
        )
        .delete(
            "/:id",
            async ({ params, profile }) => {
                authHelper.checkPermission(
                    profile,
                    Permission.METADATA_FIELDS_UPDATE,
                );
                const data = await MetadataFieldService.delete(params.id);
                return { success: true, data };
            },
            {
                params: metadataFieldIdParamSchema,
                detail: {
                    tags,
                    summary: "Xóa trường siêu dữ liệu",
                },
            },
        );
}
