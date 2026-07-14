import { Elysia, t } from "elysia";
import { httpError } from "@shared/common-lib";
import { plugins } from "../../libs/plugins/_index.ts";
import { authHelper } from "../auth/auth-helper.ts";
import { Permission } from "../auth/permission-catalog.ts";
import { ItemService, LevelService } from "./physical-warehouse-service.ts";
import { PlacementService } from "./physical-placement-service.ts";
import {
    createItemSchema,
    replaceLevelsSchema,
    updateItemSchema,
} from "./types.ts";

const idParamSchema = t.Object({
    id: t.String({ description: "ID mục kho" }),
});

const dossierIdBodySchema = t.Object({
    dossierId: t.String(),
    physicalItemId: t.String(),
    notes: t.Optional(t.Union([t.String(), t.Null()])),
});

export function createPhysicalWarehouseRouter(basePath: string = "/physical-warehouse") {
    const tags = ["PhysicalWarehouse"];

    const app = new Elysia({
        name: "physicalWarehouseRouter",
        prefix: basePath,
    })
        .use(plugins.urlQuery)
        .use(plugins.authProfile);

    app.get(
        "/levels",
        async ({ profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            return await LevelService.list();
        },
        {
            detail: {
                tags,
                summary: "Danh sách cấp cấu hình kho vật lý",
            },
        },
    );

    app.put(
        "/levels",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_CONFIG_MANAGE);
            return await LevelService.replaceAll(body);
        },
        {
            body: replaceLevelsSchema,
            detail: {
                tags,
                summary: "Thay thế / đổi tên các cấp kho vật lý",
            },
        },
    );

    app.get(
        "/items/tree",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            return await ItemService.tree(query.rootId);
        },
        {
            query: t.Object({
                rootId: t.String(),
            }),
            detail: {
                tags,
                summary: "Cây kho từ một địa điểm",
            },
        },
    );

    app.get(
        "/items/stats",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            return await ItemService.stats(query.rootId);
        },
        {
            query: t.Object({
                rootId: t.String(),
            }),
            detail: {
                tags,
                summary: "Thống kê kho theo địa điểm",
            },
        },
    );

    app.get(
        "/placements/unplaced",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            return await PlacementService.listUnplacedArchived({
                page: query.page ? Number(query.page) : 1,
                limit: query.limit ? Number(query.limit) : 20,
            });
        },
        {
            query: t.Object({
                page: t.Optional(t.String()),
                limit: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "Hồ sơ ARCHIVED chưa xếp kho vật lý",
            },
        },
    );

    app.get(
        "/placements",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            if (query.dossierId) {
                return await PlacementService.getByDossier(query.dossierId);
            }
            if (query.physicalItemId) {
                return await PlacementService.listByPhysicalItem(query.physicalItemId);
            }
            throw httpError.badRequest("Cần dossierId hoặc physicalItemId");
        },
        {
            query: t.Object({
                dossierId: t.Optional(t.String()),
                physicalItemId: t.Optional(t.String()),
            }),
            detail: {
                tags,
                summary: "Xem vị trí gắn theo hồ sơ hoặc theo hộp",
            },
        },
    );

    app.post(
        "/placements",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            const result = await PlacementService.place({
                dossierId: body.dossierId,
                physicalItemId: body.physicalItemId,
                placedBy: profile.id,
                notes: body.notes,
            });
            set.status = 201;
            return result;
        },
        {
            body: dossierIdBodySchema,
            detail: {
                tags,
                summary: "Xếp hồ sơ vào cấp cuối kho vật lý",
            },
        },
    );

    app.post(
        "/placements/move",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            return await PlacementService.move({
                dossierId: body.dossierId,
                newPhysicalItemId: body.physicalItemId,
                placedBy: profile.id,
                notes: body.notes,
            });
        },
        {
            body: dossierIdBodySchema,
            detail: {
                tags,
                summary: "Đổi vị trí kho vật lý của hồ sơ",
            },
        },
    );

    app.post(
        "/placements/remove",
        async ({ body, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            return await PlacementService.remove({
                dossierId: body.dossierId,
                notes: body.notes,
            });
        },
        {
            body: t.Object({
                dossierId: t.String(),
                notes: t.Optional(t.Union([t.String(), t.Null()])),
            }),
            detail: {
                tags,
                summary: "Gỡ hồ sơ khỏi kho vật lý",
            },
        },
    );

    app.get(
        "/items",
        async ({ query, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            return await ItemService.list({
                parentId: query.parentId ?? null,
                availableOnly: query.availableOnly === "true" || query.availableOnly === true,
            });
        },
        {
            query: t.Object({
                parentId: t.Optional(t.String()),
                availableOnly: t.Optional(t.Union([t.String(), t.Boolean()])),
            }),
            detail: {
                tags,
                summary: "Danh sách địa điểm hoặc con của một nút",
            },
        },
    );

    app.get(
        "/items/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_READ);
            return await ItemService.get(params.id);
        },
        {
            params: idParamSchema,
            detail: {
                tags,
                summary: "Chi tiết một mục kho",
            },
        },
    );

    app.post(
        "/upload-image",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            const file = body.file as File | undefined;
            if (!file) {
                throw httpError.badRequest("Chưa chọn file ảnh");
            }
            const result = await ItemService.uploadImage(file);
            set.status = 201;
            return result;
        },
        {
            body: t.Object({
                file: t.File(),
            }),
            detail: {
                tags,
                summary: "Upload ảnh kho vật lý lên S3",
            },
        },
    );

    app.post(
        "/items",
        async ({ body, profile, set }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            const result = await ItemService.create(body);
            set.status = 201;
            return result;
        },
        {
            body: createItemSchema,
            detail: {
                tags,
                summary: "Tạo địa điểm hoặc mục kho",
            },
        },
    );

    app.put(
        "/items/:id",
        async ({ params, body, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            return await ItemService.update(params.id, body);
        },
        {
            params: idParamSchema,
            body: updateItemSchema,
            detail: {
                tags,
                summary: "Cập nhật mục kho",
            },
        },
    );

    app.delete(
        "/items/:id",
        async ({ params, profile }) => {
            authHelper.checkPermission(profile, Permission.PHYSICAL_WAREHOUSE_ITEM_MANAGE);
            return await ItemService.delete(params.id);
        },
        {
            params: idParamSchema,
            detail: {
                tags,
                summary: "Xóa mục kho (chỉ khi không còn mục con / hồ sơ gắn)",
            },
        },
    );

    return app;
}
